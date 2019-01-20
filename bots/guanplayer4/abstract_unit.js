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
		this.map_horizontal_symmetry = this.isMapHorizontal(bc); //Precomp to determine map symmetry
		if (this.map_horizontal_symmetry){
			bc.log("Map is horizontally symmetric");
		}
		else{
			bc.log("Map is vertically symmetric");
		}
		this.visibleRobots = bc.getVisibleRobots();
		this.friendly_castles = this.getFriendlyCastles(bc); //Only gets visible friendly castles, need to be appended onto
		this.enemy_castles = this.getEnemyCastles(bc, this.friendly_castles);
		this.attack_mode = false; //Is in attack mode?
		//bc.log("Enemy castles predicted at: " + this.enemy_castles);
		this.actions = []; //No actions to take
		this.alert_cooldown = 0; //Used to determine if this unit can/will broadcast an alert
		this.should_micro = false; //Used to determine whether this unit should micro
		this.spotted_enemy = null; //Location of enemy spotted
		this.ownerCastle = [0, 0]; //Should not be this value, should be defined as some other value
		for (let i = 0; i < this.visibleRobots.length; i++){
			let robot = this.visibleRobots[i];
			if ((robot.unit == SPECS.CASTLE || robot.unit == SPECS.CHURCH) && robot.team == bc.me.team && this.distSquared([bc.me.x, bc.me.y], [robot.x, robot.y]) <= 2){
				this.ownerCastle = [robot.x, robot.y];
				bc.log(`Owner castle is at (${robot.x},${robot.y})`);
				break;
			}
		}
		if (bc.me.unit == SPECS.CHURCH){
			constants.noRobotFuel *= 2;
		}
		//this.bc = battleCode;
	}

	takeTurn(bc){
		//Double fuel requirement on turn 50 or if this is a church
		if (bc.me.unit != SPECS.CHURCH && bc.me.turn == 50){
			constants.noRobotFuel *= 2;
		}
		this.step++;
		this.robomap = bc.getVisibleRobotMap(); //Generate robot map once
		this.visibleRobots = bc.getVisibleRobots(); //Get visible robots
		let removedCastle = false;
		let shouldMicro = this.shouldMicro(bc);
		this.should_micro = shouldMicro;
		//Decrement Alert cooldown
		this.alert_cooldown = Math.max(this.alert_cooldown - 1, 0);
		/*if (bc.me.turn >= 5 && this.friendly_castles.length == 1 && bc.me.unit == SPECS.CRUSADER){
			bc.log("Didn't receive signal");
		}*/
		//Check if can sense enemy castle positions
		for (let i = 0; i < this.enemy_castles.length; i++){
			let rob = this.robomap[this.enemy_castles[i][1]][this.enemy_castles[i][0]];
			if (rob > 0){
				let robot = bc.getRobot(rob);
				//Not a castle or a friendly robot
				if (robot.unit != SPECS.CASTLE || robot.team == bc.me.team){
					//Not a valid enemy castle
					bc.log(`Castle at (${this.enemy_castles[i][0]}, ${this.enemy_castles[i][1]}) was not a castle!!`);
					this.enemy_castles.splice(i, 1);
					removedCastle = true;
					i--;
					continue;
				}
				/*else{
					bc.log(`Found Castle at (${this.enemy_castles[i][0]}, ${this.enemy_castles[i][1]})`);
					bc.log(this.friendly_castles);
				}*/
			}
			if (rob == 0){
				bc.log(`Castle at (${this.enemy_castles[i][0]}, ${this.enemy_castles[i][1]}) not found`);
				//Not a valid enemy castle
				this.enemy_castles.splice(i, 1);
				removedCastle = true;
				i--;
				continue;
			}
		}
		if (removedCastle){
			this.actions = this.makeMoveQueue(bc, bc.me.x, bc.me.y, this.enemy_castles);
		}
		//Issue alert if enemy nearby
		if (this.alert_cooldown <= 0){
			if (shouldMicro && this.spotted_enemy != null){
				bc.log(`Alerting enemy at (${this.spotted_enemy[0]},${this.spotted_enemy[1]})`)
				this.signalAlert(bc, 8192 + this.spotted_enemy[0] * 64 + this.spotted_enemy[1]);
				this.alert_cooldown = constants.alertCooldown;
			}
		}
		//Only execute this on mobile units
		if (bc.me.unit != SPECS.CASTLE && bc.me.unit != SPECS.CHURCH){
			//Micro takes precedence
			if (bc.me.unit != SPECS.PILGRIM){
				//Micro takes precedence
				if (shouldMicro){
					return this.microMove(bc);
				}
			}
			//Check for broadcast messages coming from friendly castles
			for (let i = 0; i < this.visibleRobots.length; i++){
				let robot = this.visibleRobots[i];
				if (robot.team == bc.me.team && (robot.unit == SPECS.CASTLE || robot.unit == SPECS.CHURCH)){
					let signal = robot.signal;
					//Castle signal
					//bc.log(`Read signal ${signal}`);
					if (signal == -1){
						//Ignore
					}
					else if (signal < 4096){
						//bc.log(`Noted: Friendly Castle at (${Math.floor(signal / 64)}, ${signal % 64})`)
						//Multiply / Divide by 64 to store info
						let newCastle = [Math.floor(signal / 64), signal % 64];
						this.addFriendlyCastle(newCastle);
						this.enemy_castles = this.getEnemyCastles(bc, this.friendly_castles);
					}
				}
				//Check for alert messages
				else if (robot.team == bc.me.team){
					let signal = robot.signal;
					if (signal >= 8192 && signal < 12288){
						//Propagate signal to other units
						this.signalAlert(bc, signal);
						//Attack signal
						signal -= 8192;
						//Move to location of disturbance
						bc.log(`Received Alert at (${Math.floor(signal / 64)},${signal % 64})`)
						if (bc.me.unit != SPECS.PILGRIM){
							return this.moveToTarget(bc, [[Math.floor(signal / 64), signal % 64]])
						}
					}
				}
			}

			//bc.log(this.friendly_castles);
			//For attacking units only
			if (bc.me.unit != SPECS.PILGRIM){
				/*if (bc.me.turn > 5 && this.enemy_castles.length == 1){
					bc.log("!! Did not receive signal !!");
				}*/
				/*if (bc.me.unit == SPECS.CRUSADER){
					bc.log(`There is ${bc.fuel}. I need ${constants.attackFuel}`)
				}*/
				//Triggers attack mode when there is enough fuel
				//Used to spread out
				if (bc.me.turn >= 3 && this.distSquared([bc.me.x, bc.me.y], [this.ownerCastle[0], this.ownerCastle[1]]) <= 4){
					//Move to somewhere random on a 4 move radius
					let tgt = this.spreadoutMove(bc, bc.me.x, bc.me.y);
					//bc.log(`Spreading out to (${tgt[0]},${tgt[1]})`)
					if (tgt != null){
						return this.moveToTarget(bc, [tgt], constants.dirFuelSave, false);
					}
				}
				let numAlliedBots = 0;
				for (let i = 0; i < this.visibleRobots.length; i++){
					let robot = this.visibleRobots[i];
					if (robot.team == bc.me.team && (robot.unit == SPECS.PROPHET || robot.unit == SPECS.PREACHER || robot.unit == SPECS.CRUSADER)){
						numAlliedBots += 1;
					}
				}
				if (numAlliedBots >= constants.criticalMass){
					//bc.log("Entering attack mode");
					this.attack_mode = true;
				}
				//Begin assault, move towards nearest known castle
				if (this.attack_mode){
					//bc.log("Targets: " + this.enemy_castles);
					//Performs a move to target
					let move = this.moveToTarget(bc, this.enemy_castles, constants.dirFast);
					if (move){
						return move;
					}
				}
			}
		}
	}

	microMove(bc){
		bc.log("Shouldn't be called. Default micro move was called");
	}

	/**
		Taken from http://indiegamr.com/generate-repeatable-random-numbers-in-js/
		Generates random numbers using the seed
	*/
	seededRandom(min = 0, max = 1) {
	 
	    this.seed = (this.seed * 9301 + 49297) % 233280;
	    let rnd = this.seed / 233280;
	 
	    return min + rnd * (max - min);
	}

	kMeansMulti(bc, numIter, k){
		let leastCost = 1000000000;
		let bestCentroids = [];
		let targets = this.getDeposits(bc, 1); //Karbonite deposits only
		for (let i = 0; i < numIter; i++){
			let centroids = this.kMeans(bc, targets, k);
			let cost = this.kMeansCost(targets, centroids);
			if (cost < leastCost){
				cost = leastCost;
				bestCentroids = centroids;
			}
			//bc.log("Finished Iteration " + i);
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
			//bc.log(targets_cpy);
			//bc.log(rnd);
			centroids.push([targets_cpy[rnd][0], targets_cpy[rnd][1]]);
			targets_cpy.splice(rnd, 1);
		}
		//bc.log("Got here");
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

	getChurchPositions(bc, friendlyCastles, enemyCastles){
		let positions = [];
		let assignments = {};
		let deposits = this.getDeposits(bc);
		//Consider both friendly and enemy castles
		for (let i = 0; i < friendlyCastles.length; i++){
			positions.push([friendlyCastles[i][0], friendlyCastles[i][1]]);
		}
		for (let i = 0; i < enemyCastles.length; i++){
			positions.push([friendlyCastles[i][0], friendlyCastles[i][1]]);
		}
		//Eliminate all coordinates that are already processed
		for (let i = 0; i < positions.length; i++){
			//assignments[i] = [];
			for (let j = 0; j < deposits.length; j++){
				if (this.distSquared(positions[i], deposits[j]) <= constants.clusterRadius){
					deposits.splice(j, 1);
					j--;
				}
			}
		}
		//Assignments and positions only for churches, not for castles
		positions = [];
		//Process the rest of the deposits
		while (deposits.length > 0){
			//bc.log(deposits.length);
			let newCluster = deposits.splice(0, 1);
			let dep = newCluster[0];
			for (let i = 0; i < deposits.length; i++){
				if (this.distSquared(dep, deposits[i]) <= constants.clusterRadius * 4){
					newCluster.push(deposits[i]);
					deposits.splice(i, 1);
					i--;
				}
			}
			//bc.log(newCluster);
			//Add new cluster to list
			let sum = [0, 0];
			for (let i = 0; i < newCluster.length; i++){
				sum[0] += newCluster[i][0];
				sum[1] += newCluster[i][1];
			}
			sum[0] = Math.floor(sum[0] / newCluster.length);
			sum[1] = Math.floor(sum[1] / newCluster.length);
			//bc.log(sum);
			let finalPos = [0,0];
			//Build church at sum[0],sum[1]
			for (let i = 0; i < constants.dirBuildChurch.length; i++){
				let dir = constants.dirBuildChurch[i];
				let nx = sum[0] + dir[0];
				let ny = sum[1] + dir[1];
				if (!bc.karbonite_map[ny][nx] && !bc.fuel_map[ny][nx] && bc.map[ny][nx]){
					finalPos = [nx, ny];
					break;
				}
			}
			//bc.log(finalPos);
			assignments[positions.length] = newCluster;
			positions.push(finalPos);
		}
		//Evaluate and sort church positions by their values
		let newPositions = [];
		for (let i = 0; i < positions.length; i++){
			newPositions.push([i, positions[i]]);
		}
		let unit = this;
		newPositions.sort(function(pos1, pos2){
			let score1 = unit.getChurchScore(pos1[1], assignments[pos1[0]], friendlyCastles, enemyCastles);
			let score2 = unit.getChurchScore(pos2[1], assignments[pos2[0]], friendlyCastles, enemyCastles);
			return score2 - score1;
		});
		positions = [];
		let newAssignments = {};
		for (let i = 0; i < newPositions.length; i++){
			positions.push(newPositions[i][1]);
			newAssignments[i] = assignments[newPositions[i][0]];
		}
		assignments = newAssignments;
		//First church position should have highest score
		bc.log("Church Positions");
		bc.log(positions);
		bc.log("Church Assignments");
		bc.log(assignments);
		//Return an array containing a positions array and an assignments array
		return [positions, assignments];
	}

	getChurchScore(churchPos, assignedRes, friendlyCastles, enemyCastles){
		//Get minimum distance squared to an enemy castle
		let leastDistSquared = 1000000000;
		for (let i = 0; i < enemyCastles.length; i++){
			leastDistSquared = Math.min(leastDistSquared, this.distSquared(enemyCastles[i], churchPos));
		}
		//Get expected resource income from this church
		//Need to adjust this
		//Tweak constants to adjust between risk and reward
		return Math.pow(leastDistSquared, 0.66) * 10 + assignedRes.length * 200;
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
		@param x the origin x position
		@param y the origin y position
		@param targets An array of [x,y] which represent all the targets to move to
		@param dir the available directions that this robot can move in
		@param returnNearestTarget returns [[targetX, targetY], dist] instead of an array of directions to take
		@return null if unreachable, array containing moves [dirx, diry] if reachable
	*/
	makeMoveQueue(bc, x, y, targets, dir = constants.dirFuelSave, passThruUnits = true, returnNearestTarget = false){
		if (targets.length == 0){
			return [];
		}
		let map_height = this.map_height;
		let map_width = this.map_width;
		//Perform BFS to generate a move grid
		let visited = [];
		let moveGrid = [];
		let lastMoveGrid = [];
		let isTarget = [];
		for (let i = 0; i < map_height; i++){
			visited.push([]);
			moveGrid.push([]);
			lastMoveGrid.push([]);
			isTarget.push([]);
			for (let j = 0; j < map_width; j++){
				visited[i].push(false);
				moveGrid[i].push(-1);
				lastMoveGrid[i].push(null);
				isTarget[i].push(false);
			}
		}
		moveGrid[y][x] = 0;
		visited[y][x] = true;
		for (let i = 0; i < targets.length; i++){
			isTarget[targets[i][1]][targets[i][0]] = true;
		}
		let queue = [[x, y]];
		let robomap = this.robomap;
		let targetX = -1;
		let targetY = -1;
		//Perform BFS on grid
		while (queue.length > 0){
			let pos = queue.splice(0, 1)[0];
			//bc.log("Processing: " + pos);
			for (let i = 0; i < dir.length; i++){
				let newPos = [pos[0] + dir[i][0], pos[1] + dir[i][1]];
				if (!this.isWithinMap(newPos[0], newPos[1]) || !bc.map[newPos[1]][newPos[0]] || visited[newPos[1]][newPos[0]]){
					continue;
				}
				let rob = robomap[newPos[1]][newPos[0]];
				let robot = (rob > 0) ? bc.getRobot(rob) : null;
				//bc.log("Hi I'm here");
				//Can't move past castles or churches
				if (passThruUnits){
					if (rob > 0 && robot != null && (robot.unit == SPECS.CASTLE || robot.unit == SPECS.CHURCH)){
						continue;
					}
				}
				else{
					//Can't move past any type of units
					if (rob > 0 && robot != null){
						continue;
					}
				}
				moveGrid[newPos[1]][newPos[0]] = moveGrid[pos[1]][pos[0]] + 1;
				lastMoveGrid[newPos[1]][newPos[0]] = dir[i];
				visited[newPos[1]][newPos[0]] = true;
				queue.push([newPos[0], newPos[1]]);
				if (isTarget[newPos[1]][newPos[0]]){
					targetX = newPos[0];
					targetY = newPos[1];
					//bc.log("Done. Exiting BFS");
					queue = [];
					//bc.log("targetX: " + targetX + "targetY: " + targetY);
					break;
				}
			}
		}
		if (returnNearestTarget){
			if (targetX != -1 && targetY != -1){
				return [[targetX, targetY], moveGrid[targetY][targetX]];
			}
		}
		//Debug step
		//bc.log(moveGrid);
		//Do backtracking
		let actions = [];
		if (targetX == -1 && targetY == -1){
			//Couldn't reach any targets
			return [];
		}
		let pos = [targetX, targetY];
		while (pos[0] != x || pos[1] != y){
			//bc.log("Pos: " + pos);
			let lastAction = lastMoveGrid[pos[1]][pos[0]];
			if (lastAction == null){
				//This location is unreachable
				bc.log("Unreachable, targetX: " + targetX + " targetY: " + targetY);
				return [];
			}
			actions.push(lastAction);
			pos = [pos[0] - lastAction[0], pos[1] - lastAction[1]];
		}
		//Reverse actions
		let rev = [];
		for (let i = actions.length - 1; i >= 0; i--){
			rev.push(actions[i]);
		}
		return rev;
	}

	spreadoutMove(bc, x, y, numSpread = constants.defaultSpread, dir = constants.dirFuelSave){
		let map_height = this.map_height;
		let map_width = this.map_width;
		//Perform BFS to generate a move grid
		let visited = [];
		let moveGrid = [];
		for (let i = 0; i < map_height; i++){
			visited.push([]);
			moveGrid.push([]);
			for (let j = 0; j < map_width; j++){
				visited[i].push(false);
				moveGrid[i].push(-1);
			}
		}
		moveGrid[y][x] = 0;
		visited[y][x] = true;
		let possibleLoc = [];
		let queue = [[x, y]];
		let robomap = this.robomap;
		//Perform BFS on grid
		while (queue.length > 0){
			let pos = queue.splice(0, 1)[0];
			//bc.log("Processing: " + pos);
			for (let i = 0; i < dir.length; i++){
				let newPos = [pos[0] + dir[i][0], pos[1] + dir[i][1]];
				if (!this.isWithinMap(newPos[0], newPos[1]) || !bc.map[newPos[1]][newPos[0]] || visited[newPos[1]][newPos[0]]){
					continue;
				}
				let rob = robomap[newPos[1]][newPos[0]];
				let robot = (rob > 0) ? bc.getRobot(rob) : null;
				//bc.log("Hi I'm here");
				if (rob > 0 && robot != null){
					continue;
				}
				moveGrid[newPos[1]][newPos[0]] = moveGrid[pos[1]][pos[0]] + 1;
				if (moveGrid[newPos[1]][newPos[0]] == numSpread){
					possibleLoc.push([newPos[0], newPos[1]]);
				}
				else if (moveGrid[newPos[1]][newPos[0]] > numSpread){
					break;
				}
				visited[newPos[1]][newPos[0]] = true;
				queue.push([newPos[0], newPos[1]]);
			}
		}
		if (possibleLoc.length == 0){
			return null;
		}
		//Sort possible locations by distance to enemy castle
		let enemyCastle = this.getOppositePoint(this.ownerCastle[0], this.ownerCastle[1], this.map_horizontal_symmetry);
		possibleLoc.sort((a,b) => {
			return this.distSquared(a, enemyCastle) - this.distSquared(b, enemyCastle);
		})
		let debugArr = [];
		for (let i = 0; i < possibleLoc.length; i++){
			debugArr.push(this.distSquared(possibleLoc[i], enemyCastle));
		}
		return possibleLoc[Math.floor(this.seededRandom(0, Math.floor(possibleLoc.length * constants.spreadRatio)))];
	}

	moveToTarget(bc, targets, dir = constants.dirFuelSave, passThruUnits = true){
		if (this.actions.length == 0){
			//Request more actions to perform
			this.actions = this.makeMoveQueue(bc, bc.me.x, bc.me.y, targets, dir, passThruUnits);
		}
		if (this.actions.length != 0){
			let action = this.actions.splice(0, 1)[0];
			//Check if move is valid, if not request additional moves
			let newPos = [bc.me.x + action[0], bc.me.y + action[1]];
			//Then check if move is valid. If still incorrect, perform no action
			if (!this.isOccupied(bc, newPos[0], newPos[1])){
				return bc.move(action[0], action[1]);
			}
			else{
				//Move is invalid, recompute
				this.actions = this.makeMoveQueue(bc, bc.me.x, bc.me.y, targets, dir, false);
				if (this.actions.length != 0){
					action = this.actions.splice(0, 1)[0];
					newPos = [bc.me.x + action[0], bc.me.y + action[1]];
					if (!this.isOccupied(bc, newPos[0], newPos[1])){
						return bc.move(action[0], action[1]);
					}
				}
				//Give up if unable to move
				bc.log("Gave up moving");
				//bc.log(targets);
			}
		}
		bc.log("No valid move");
	}

	signalAlert(bc, signal){
		/*
			Guide to signals:
			< 4096 => Allied castle location signal (x * 64 + y)
			4096 - 8191 => signal - 4096 is the location on resource array to gather at
			8192 - 12288 => Alert signal, signal - 8192 is the location on map where an attack is reported
		*/
		//TODO: Get nearby alerting units
		//TODO: Check if all non alerting units are covered by alerting units (maxRadius)
		//TODO: If some non alerting unit is not covered, signal the alert
		if (bc.fuel <= constants.noSignalFuel){
			return;
		}
		let alertUnits = [];
		for (let i = 0; i < this.visibleRobots.length; i++){
			let robot = this.visibleRobots[i];
			let signal = robot.signal;
			if (signal >= 8192 && signal < 12288){
				alertUnits.push([robot.x, robot.y]);
			}
		}
		let unalertedUnits = [];
		for (let i = 0; i < this.visibleRobots.length; i++){
			let robot = this.visibleRobots[i];
			if (robot.x == null || robot.team != bc.me.team){
				continue;
			}
			if (robot.unit == SPECS.CASTLE || robot.unit == SPECS.PILGRIM || robot.unit == SPECS.CHURCH){
				continue;
			}
			//bc.log("Check covering");
			//bc.log(alertUnits.length);
			let isCovered = false;
			for (let j = 0; j < alertUnits.length; j++){
				let alertRobot = alertUnits[j];
				//bc.log("Dist: " + this.distSquared([robot.x, robot.y], [alertRobot[0], alertRobot[1]]));
				if (this.distSquared([robot.x, robot.y], [alertRobot[0], alertRobot[1]]) <= constants.maxAlertRadius){
					isCovered = true;
					break;
				}
			}
			if (!isCovered){
				unalertedUnits.push([robot.x, robot.y]);
			}
		}
		let radius = 0;
		for (let i = 0; i < unalertedUnits.length; i++){
			let unit = unalertedUnits[i];
			let distSquared = this.distSquared([bc.me.x, bc.me.y], [unit[0], unit[1]]);
			radius = Math.max(radius, Math.min(distSquared, constants.maxAlertRadius));
		}
		if (radius == 0){
			return;
		}
		bc.signal(signal, radius);
		bc.log(`Signalling Alert ${signal} at radius ${radius}`)
	}

	/**
		Map is always either horizontally or vertically symmetric but we do not know which is true
		@return true if the map is horizontal, false if it is vertical
	*/
	isMapHorizontal(bc){
		for (let i = 0; i < this.map_height; i++){
			for (let j = 0; j < this.map_width; j++){
				let opp = this.getOppositePoint(j, i, true);
				//Assume horizontal then check if that is true
				if (bc.map[opp[1]][opp[0]] != bc.map[i][j] ||
					bc.karbonite_map[opp[1]][opp[0]] != bc.karbonite_map[i][j] ||
					bc.fuel_map[opp[1]][opp[0]] != bc.fuel_map[i][j]){
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
		if (isHorizontallySymmetric){
			return [this.map_width - x - 1, y];
		}
		else{
			return [x, this.map_height - y - 1];
		}
	}

	/**
		@param other a Robot object
	*/
	isWithinRange(bc, other){
		let dist = this.distSquared([bc.me.x, bc.me.y], [other.x, other.y]);
		let attackRadius = SPECS.UNITS[bc.me.unit].ATTACK_RADIUS;
		return attackRadius[0] <= dist && dist <= attackRadius[1];
	}

	canAttack(bc, other){
		return this.isWithinRange(bc, other); //&& bc.fuel >= SPECS.UNITS[bc.me.unit].ATTACK_FUEL_COST;
	}

	addFriendlyCastle(newCastle){
		for (let j = 0; j < this.friendly_castles.length; j++){
			if (newCastle[0] == this.friendly_castles[j][0] && newCastle[1] == this.friendly_castles[j][1]){
				return;
			}
		}
		this.friendly_castles.push(newCastle);
	}

	getFriendlyCastles(bc){
		let robots = this.visibleRobots;
		let friendlyCastles = [];
		for (let i = 0; i < robots.length; i++){
			if (robots[i].team == bc.me.team && robots[i].unit == SPECS.CASTLE){
				friendlyCastles.push([robots[i].x, robots[i].y]);
			}
		}
		return friendlyCastles;
	}

	getEnemyCastles(bc, friendlyCastles){
		let enemyCastles = [];
		for (let i = 0; i < friendlyCastles.length; i++){
			enemyCastles.push(this.getOppositePoint(friendlyCastles[i][0], friendlyCastles[i][1], this.map_horizontal_symmetry));
		}
		return enemyCastles;
	}

	/**
		@return whether this unit should conduct micro
	*/
	shouldMicro(bc){
		let robots = this.visibleRobots;
		let nearestEnemy = 1000000000;
		for (let i = 0; i < robots.length; i++){
			let other = robots[i];
			let distSquared = this.distSquared([bc.me.x, bc.me.y], [other.x, other.y]);
			if (other.team != bc.me.team){
				nearestEnemy = Math.min(nearestEnemy, distSquared);
			}
			if (other.team != bc.me.team && distSquared <= constants.microRadius){
				//bc.log("Nearest Enemy is too close");
				this.spotted_enemy = [other.x, other.y];
				return true;
			}
		}
		//bc.log(`Nearest Enemy at ${nearestEnemy}`);
		return false;
	}

	isWithinMap(x, y){
		if (x < 0 || x >= this.map_width || y < 0 || y >= this.map_height){
			return false;
		}
		return true;
	}

	isOccupied(bc, x, y){
		return !this.isWithinMap(x,y) || this.robomap[y][x] > 0 || !bc.map[y][x];
	}

	/**
		@param minKarbLeft the minimum amount of karbonite that needs to be left
		@param minFuelLeft the minimum amount of fuel that needs to be left
		@return true if there are sufficient resources to construct this unit, false if there are not
	*/
	hasEnoughResources(bc, unitType, minKarbLeft = 0, minFuelLeft = 0){
		return bc.karbonite >= SPECS.UNITS[unitType].CONSTRUCTION_KARBONITE + minKarbLeft 
		&& bc.fuel >= SPECS.UNITS[unitType].CONSTRUCTION_FUEL + minFuelLeft;
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