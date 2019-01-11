import {SPECS} from 'battlecode';
import {constants} from 'constants.js';
/**
	This class provides shared methods for all unit classes
*/
export class AbstractUnit{
	/**
		Creates an instance of the abstract unit
		@param battleCode the main class provided by the battlecode source
	*/
	constructor(bc){
		this.seed = 2352; //Seed used for RNG Generation (Some random number)
		this.step = 0; //Used to count how many turns this bot has existed
		this.map_height = bc.map.length; //Convenience for map height
		this.map_width = bc.map[0].length; //Convenience for map width
		this.map_horizontal_symmetry = isMapHorizontal(); //Precomp to determine map symmetry
		if (this.map_horizontal_symmetry){
			bc.log("Map is horizontally symmetric");
		}
		else{
			bc.log("Map is vertically symmetric");
		}
		this.enemy_castles = this.getEnemyCastles(bc);
		this.attack_mode = false; //Is in attack mode?
		bc.log("Enemy castles predicted at: " + this.enemy_castles);
		this.actions = []; //No actions to take
		//this.bc = battleCode;
	}

	takeTurn(bc){
		this.step++;
		this.robomap = bc.getVisibleRobotMap(); //Generate robot map once
		//Check if can sense enemy castle positions
		for (let i = 0; i < this.enemy_castles.length; i++){
			let rob = this.robomap[this.enemy_castles[i][1]][this.enemy_castles[i][0]];
			if (rob > 0){
				let robot = this.getRobot(rob);
				//Not a castle or a friendly robot
				if (robot.unit != SPECS.CASTLE || robot.team == bc.me.team){
					//Not a valid enemy castle
					this.enemy_castles.splice(i, 1);
					i--;
					continue;
				}
			}
			if (rob == 0){
				//Not a valid enemy castle
				this.enemy_castles.splice(i, 1);
				i--;
				continue;
			}
		}
		//Triggers attack mode when there is enough fuel
		if (bc.fuel >= constants.attackFuel){
			this.attack_mode = true;
		}
		//Begin assault, move towards nearest known castle
		if (this.attack_mode){
			//Checks if there is some move in the move queue
			if (this.actions.length == 0){
				//Request more actions to perform
				this.makeMoveQueue(bc.me.x, bc.me.y, this.enemy_castles);
			}
			let action = this.actions.splice(0, 1)[0];
			//Check if move is valid, if not request additional moves
			let newPos = [bc.me.x + action[0], bc.me.y + action[1]];
			//Then check if move is valid. If still incorrect, perform no action
			if (this.isOccupied(bc, newPos[0], newPos[1])){
				return bc.move(action[0], action[1]);
			}
			else{
				//Move is invalid, recompute
				this.makeMoveQueue(bc.me.x, bc.me.y, this.enemy_castles);
				action = this.actions.splice(0, 1)[0];
				newPos = [bc.me.x + action[0], bc.me.y + action[1]];
				if (this.isOccupied(bc, newPos[0], newPos[1])){
					return bc.move(action[0], action[1]);
				}
				//Give up if unable to move
				bc.log("Gave up moving");
			}
		}
		else{
			//TODO: Perform micro move
			bc.log("TODO: perform micro move");
		}
	}

	/**
		Taken from http://indiegamr.com/generate-repeatable-random-numbers-in-js/
		Generates random numbers using the seed
	*/
	seededRandom(max, min) {
	    max = max || 1;
	    min = min || 0;
	 
	    this.seed = (this.seed * 9301 + 49297) % 233280;
	    let rnd = this.seed / 233280;
	 
	    return min + rnd * (max - min);
	}

	kMeansMulti(bc, numIter, k){
		let leastCost = 1000000000;
		let bestCentroids = [];
		let targets = this.getDeposits(bc, depositType = 1); //Karbonite deposits only
		for (let i = 0; i < numIter; i++){
			let centroids = this.kMeans(bc, targets, k);
			let cost = this.kMeansCost(targets, centroids);
			if (cost < leastCost){
				cost = leastCost;
				bestCentroids = centroids;
			}
		}
		//Debug
		bc.log(this.kMeansSets(targets, bestCentroids));
		bc.log(bestCentroids);
		return bestCentroids;
	}
	/**
		Returns a deterministic set of coordinates
		@param bc Teh battlecode interface
		@param targets An array of [x,y] indicating the positions of the targets
	*/
	kMeans(bc, targets, k){
		//Get Deterministic starting points
		let map_height = this.map_height;
		let map_width = this.map_width;
		let centroids = [];
		//Randomly initialize centroids
		/*for (let i = 0; i < k; i++){
			centroids.push([this.seededRandom(0, map_width), this.seededRandom(0, map_height)]);
		}*/
		let targets_cpy = [];
		//Copy targets
		for (let i = 0; i < targets.length; i++){
			targets_cpy.push([targets[i][0], targets[i][1]]);
		}
		//Initialize centroids as random starting points
		for (let i = 0; i < k; i++){
			//Empty, use every point as centroid
			if (targets_cpy.length == 0){
				k = centroids.length;
				break;
			}
			let rnd = Math.floor(this.seededRandom(0, targets_cpy.length));
			centroids.push([targets_cpy[rnd][0], targets_cpy[rnd][1]]);
			targets_cpy.splice(rnd, 1);
		}
		let prevCentroids = null;
		let numIter = 0;
		while (true){
			numIter ++;
			//Perform k means clustering
			//Initiate precomp
			let newCentroids = [];
			for (let i = 0; i < k; i++){
				newCentroids.push([0,0,0]);
			}
			//Assign points to Centroids, then reposition centroids
			for (let i = 0; i < targets.length; i++){
				let bestCentroid = 0;
				let leastDistSquared = 1000000000;
				for (let j = 0; j < k; j++){
					let d = this.distSquared(centroids[j], targets[i]);
					if (d < leastDistSquared){
						leastDistSquared = d;
						bestCentroid = j;
					}
				}
				//Sum up for each centroid
				newCentroids[bestCentroid][0] += targets[i][0];
				newCentroids[bestCentroid][1] += targets[i][1];
				newCentroids[bestCentroid][2] += 1;
			}
			//Deep copy previous centroids
			prevCentroids = [];
			for (let i = 0; i < k; i++){
				prevCentroids.push(centroids[i]);
			}
			centroids = [];
			//bc.log(newCentroids);
			//Update centroids
			for (let i = 0; i < k; i++){
				if (newCentroids[i][2] == 0){
					continue;
				}
				centroids.push([newCentroids[i][0] / newCentroids[i][2], newCentroids[i][1] / newCentroids[i][2]]);
			}
			//bc.log(centroids)
			k = centroids.length;
			/*if (k != prevCentroids.length){
				bc.log("Eliminated Centroid");
			}*/
			//Computes cost to check for convergence (debug)
			let cost = this.kMeansCost(targets, centroids);
			//bc.log(numIter);
			//bc.log('K Means Cost is: ' + cost);
			//Check whether clustering is complete
			let isDone = true;
			for (let i = 0; i < k; i++){
				if (centroids[i][0] != prevCentroids[i][0] || centroids[i][1] != prevCentroids[i][1]){
					isDone = false;
					break;
				}
			}
			if (isDone){
				//bc.log("Done")
				break;
			}
			//bc.log(numIter);
			//Should't go here
			if (numIter > 20){
				bc.log("Unexpected: Exceeded max iterations on k means");
				break;
			}
		}
		return centroids;
	}

	kMeansCost(targets, centroids){
		let cost = 0;
		for (let i = 0; i < targets.length; i++){
			let bestCentroid = 0;
			let leastDistSquared = 1000000000;
			for (let j = 0; j < centroids.length; j++){
				let d = this.distSquared(centroids[j], targets[i]);
				if (d < leastDistSquared){
					leastDistSquared = d;
					bestCentroid = j;
				}
			}
			cost += this.dist(centroids[bestCentroid], targets[i]);
		}
		return cost;
	}

	kMeansSets(targets, centroids){
		let ans = {};
		for (let i = 0; i < centroids.length; i++){
			ans[i] = [];
		}
		for (let i = 0; i < targets.length; i++){
			let bestCentroid = 0;
			let leastDistSquared = 1000000000;
			for (let j = 0; j < centroids.length; j++){
				let d = this.distSquared(centroids[j], targets[i]);
				if (d < leastDistSquared){
					leastDistSquared = d;
					bestCentroid = j;
				}
			}
			ans[bestCentroid].push(targets[i]);
		}
		return ans;
	}

	/**
		@param depositType 0 => both deposits, 1 => karbonite only, 2 => fuel only
		Returns an array of (x,y) coordinate pairs that contain deposits of both types
	*/
	getDeposits(bc, depositType = 0){
		let targets = [];
		for (let i = 0; i < bc.map.length; i++){
			for (let j = 0; j < bc.map[i].length; j++){
				if (depositType == 0){
					if (bc.karbonite_map[i][j] == true || bc.fuel_map[i][j] == true){
						targets.push([j, i]);
					}
				}
				else if (depositType == 1){
					if (bc.karbonite_map[i][j] == true){
						targets.push([j, i]);
					}
				}
				else if (depositType == 2){
					if (bc.fuel_map[i][j] == true){
						targets.push([j, i]);
					}
				}
			}
		}
		return targets;
	}

	/**
		@param centroids a list of all the centroids
		@param deposits a list of all the deposits
		@param centroidId the ID of the centroid to be queried for
	*/
	depositsFromCentroids(centroids, deposits, centroidId){
		let ans = [];
		//Assign points to Centroids, then reposition centroids
		for (let i = 0; i < deposits.length; i++){
			let bestCentroid = 0;
			let leastDistSquared = 1000000000;
			for (let j = 0; j < k; j++){
				let d = this.distSquared(centroids[j], deposits[i]);
				if (d < leastDistSquared){
					leastDistSquared = d;
					bestCentroid = j;
				}
			}
			if (bestCentroid == centroidId){
				ans.push([deposits[i][0], deposits[i][1]]);
			}
		}
		return ans;
	}

	/**
		@param targets An array of [x,y] which represent all the targets to move to
		@return null if unreachable, array containing moves [dirx, diry] if reachable
	*/
	makeMoveQueue(x, y, targets){
		let map_height = this.map_height;
		let map_width = this.map_width;
		//Perform BFS to generate a move grid
		let visited = [];
		let moveGrid = [];
		let lastMoveGrid = [];
		let isTarget = [];
		for (let i = 0; i < map_height; i++){
			visited.push([]);
			for (let j = 0; j < map_width; j++){
				visited[i].push(false);
				moveGrid[i].push(-1);
				lastMoveGrid[i].push(null);
				isTarget.push(false);
			}
		}
		moveGrid[y][x] = 0;
		visited[y][x] = true;
		for (let i = 0; i < targets.length; i++){
			isTarget[targets[i][1]][targets[i][0]] = true;
		}
		let queue = [[x, y]];
		let robomap = this.robomap;
		//Perform BFS on grid
		while (queue.length > 0){
			let pos = queue.splice(0, 1)[0];
			const dir = [[0,-1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
			for (let i = 0; i < dir.length; i++){
				let newPos = [pos[0] + dir[i][0], pos[1] + dir[i][1]];
				if (!isWithinMap(newPos[0], newPos[1]) || !bc.map[newPos[1]][newPos[0]] || visited[newPos[1]][newPos[0]]){
					continue;
				}
				let rob = robomap[newPos[1]][newPos[0]];
				let robot = (rob > 0) ? this.getRobot(rob) : null;
				//Can't move past castles or churches
				if (rob > 0 && robot != null && (robot.unit == SPECS.CASTLE || robot.unit == SPECS.CHURCH)){
					continue;
				}
				moveGrid[newPos[1]][newPos[0]] = moveGrid[pos[1]][pos[0]] + 1;
				lastMoveGrid[newPos[1]][newPos[0]] = dir[i];
				visited[newPos[1]][newPos[0]] = true;
				if (isTarget[newPos[1]][newPos[0]]){
					bc.log("Done. Exiting BFS");
					break;
				}
			}
		}
		//Debug step
		bc.log(moveGrid);
		//Do backtracking
		let actions = [];
		let pos = [targetX, targetY];
		while (pos[0] != x && pos[1] != y){
			let lastAction = lastMoveGrid[pos[1]][pos[0]];
			if (lastAction == null){
				//This location is unreachable
				return null;
			}
			actions.push(lastAction);
			pos = [pos[0] - lastAction[0], pos[1] - lastAction[1]];
		}
		//Reverse actions
		let rev = [];
		for (let i = actions.length - 1; i >= 0; i--){
			rev.push([actions[i][0], actions[i][1]]);
		}
		return rev;
	}

	/**
		Map is always either horizontally or vertically symmetric but we do not know which is true
		@return true if the map is horizontal, false if it is vertical
	*/
	isMapHorizontal(){
		for (let i = 0; i < this.map_height; i++){
			for (let j = 0; j < this.map_width; j++){
				opp = this.getOppositePoint(j, i, true);
				//Assume horizontal then check if that is true
				if (this.map[opp[1]][opp[0]] != this.map[i][j] ||
					this.karbonite_map[opp[1]][opp[0]] != this.karbonite_map[i][j] ||
					this.fuel_map[opp[1]][opp[0]] != this.fuel_map[i][j]){
					return false;
				}
			}
		}
		return true;
	}

	/**
		Get opposite point
	*/
	getOppositePoint(x, y, isHorizontallySymmetric){
		let map_height = bc.map.length;
		let map_width = bc.map[0].length;
		if (isHorizontallySymmetric){
			return [map_width - x - 1, y];
		}
		else{
			return [x, map_height - y - 1];
		}
	}

	/**
		Returns a list of points [x,y] indicating the locations of the enemy castles
	*/
	getEnemyCastles(bc){
		let robots = bc.getVisibleRobots();
		let enemyCastles = [];
		for (let i = 0; i < robots.length; i++){
			if (robots[i].team == bc.me.team && robots[i].unit == SPECS.CASTLE){
				enemyCastles.push(this.getOppositePoint(robots[i].x, robots[i].y, this.map_horizontal_symmetry));
			}
		}
		return enemyCastles;
	}

	/**
		@return whether this unit should conduct micro
	*/
	shouldMicro(bc){
		let robots = bc.getVisibleRobots();
		for (let i = 0; i < robots.length; i++){
			let other = robots[i];
			if (other.team != bc.me.team && this.distSquared([bc.me.x, bc.me.y], [other.x, other.y]) <= constants.microRadius){
				return true;
			}
		}
		return false;
	}

	isWithinMap(x, y){
		if (x < 0 || x >= this.map_width || y < 0 || y >= this.map_height){
			return false;
		}
		return true;
	}

	isOccupied(bc, x, y){
		return !this.isWithinMap(x,y) || this.robomap[y][x] > 0 || bc.map[y][x];
	}

	/**
		@param minKarbLeft the minimum amount of karbonite that needs to be left
		@param minFuelLeft the minimum amount of fuel that needs to be left
		@return true if there are sufficient resources to construct this unit, false if there are not
	*/
	hasEnoughResources(bc, unitType, minKarbLeft = 0, minFuelLeft = 0){
		return bc.karbonite >= unitType.CONSTRUCTION_KARBONITE + minKarbLeft 
		&& bc.fuel >= unitType.CONSTRUCTION_FUEL + minFuelLeft;
	}

	/**
		@param pos1 a 2 element 1D array representing the first position
		@param pos2 a 2 element 1D array representing the second position
		@return the distance between positions 1 and 2
	*/
	dist(pos1, pos2){
		return Math.sqrt(this.distSquared(pos1, pos2));
	}

	distSquared(pos1, pos2){
		return (pos1[0] - pos2[0]) * (pos1[0] - pos2[0]) + (pos1[1] - pos2[1]) * (pos1[1] - pos2[1]);
	}


}