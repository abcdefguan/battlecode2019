'use strict';

var SPECS = {"COMMUNICATION_BITS":16,"CASTLE_TALK_BITS":8,"MAX_ROUNDS":1000,"TRICKLE_FUEL":25,"INITIAL_KARBONITE":100,"INITIAL_FUEL":500,"MINE_FUEL_COST":1,"KARBONITE_YIELD":2,"FUEL_YIELD":10,"MAX_TRADE":1024,"MAX_BOARD_SIZE":64,"MAX_ID":4096,"CASTLE":0,"CHURCH":1,"PILGRIM":2,"CRUSADER":3,"PROPHET":4,"PREACHER":5,"RED":0,"BLUE":1,"CHESS_INITIAL":100,"CHESS_EXTRA":20,"TURN_MAX_TIME":200,"MAX_MEMORY":50000000,"UNITS":[{"CONSTRUCTION_KARBONITE":null,"CONSTRUCTION_FUEL":null,"KARBONITE_CAPACITY":null,"FUEL_CAPACITY":null,"SPEED":0,"FUEL_PER_MOVE":null,"STARTING_HP":100,"VISION_RADIUS":100,"ATTACK_DAMAGE":null,"ATTACK_RADIUS":null,"ATTACK_FUEL_COST":null,"DAMAGE_SPREAD":null},{"CONSTRUCTION_KARBONITE":50,"CONSTRUCTION_FUEL":200,"KARBONITE_CAPACITY":null,"FUEL_CAPACITY":null,"SPEED":0,"FUEL_PER_MOVE":null,"STARTING_HP":50,"VISION_RADIUS":100,"ATTACK_DAMAGE":null,"ATTACK_RADIUS":null,"ATTACK_FUEL_COST":null,"DAMAGE_SPREAD":null},{"CONSTRUCTION_KARBONITE":10,"CONSTRUCTION_FUEL":50,"KARBONITE_CAPACITY":20,"FUEL_CAPACITY":100,"SPEED":4,"FUEL_PER_MOVE":1,"STARTING_HP":10,"VISION_RADIUS":100,"ATTACK_DAMAGE":null,"ATTACK_RADIUS":null,"ATTACK_FUEL_COST":null,"DAMAGE_SPREAD":null},{"CONSTRUCTION_KARBONITE":20,"CONSTRUCTION_FUEL":50,"KARBONITE_CAPACITY":20,"FUEL_CAPACITY":100,"SPEED":9,"FUEL_PER_MOVE":1,"STARTING_HP":40,"VISION_RADIUS":36,"ATTACK_DAMAGE":10,"ATTACK_RADIUS":[1,16],"ATTACK_FUEL_COST":10,"DAMAGE_SPREAD":0},{"CONSTRUCTION_KARBONITE":25,"CONSTRUCTION_FUEL":50,"KARBONITE_CAPACITY":20,"FUEL_CAPACITY":100,"SPEED":4,"FUEL_PER_MOVE":2,"STARTING_HP":20,"VISION_RADIUS":64,"ATTACK_DAMAGE":10,"ATTACK_RADIUS":[16,64],"ATTACK_FUEL_COST":25,"DAMAGE_SPREAD":0},{"CONSTRUCTION_KARBONITE":30,"CONSTRUCTION_FUEL":50,"KARBONITE_CAPACITY":20,"FUEL_CAPACITY":100,"SPEED":4,"FUEL_PER_MOVE":3,"STARTING_HP":60,"VISION_RADIUS":16,"ATTACK_DAMAGE":20,"ATTACK_RADIUS":[1,16],"ATTACK_FUEL_COST":15,"DAMAGE_SPREAD":3}]};

function insulate(content) {
    return JSON.parse(JSON.stringify(content));
}

class BCAbstractRobot {
    constructor() {
        this._bc_reset_state();
    }

    // Hook called by runtime, sets state and calls turn.
    _do_turn(game_state) {
        this._bc_game_state = game_state;
        this.id = game_state.id;
        this.karbonite = game_state.karbonite;
        this.fuel = game_state.fuel;
        this.last_offer = game_state.last_offer;

        this.me = this.getRobot(this.id);

        if (this.me.turn === 1) {
            this.map = game_state.map;
            this.karbonite_map = game_state.karbonite_map;
            this.fuel_map = game_state.fuel_map;
        }

        try {
            var t = this.turn();
        } catch (e) {
            t = this._bc_error_action(e);
        }

        if (!t) t = this._bc_null_action();

        t.signal = this._bc_signal;
        t.signal_radius = this._bc_signal_radius;
        t.logs = this._bc_logs;
        t.castle_talk = this._bc_castle_talk;

        this._bc_reset_state();

        return t;
    }

    _bc_reset_state() {
        // Internal robot state representation
        this._bc_logs = [];
        this._bc_signal = 0;
        this._bc_signal_radius = 0;
        this._bc_game_state = null;
        this._bc_castle_talk = 0;
        this.me = null;
        this.id = null;
        this.fuel = null;
        this.karbonite = null;
        this.last_offer = null;
    }

    // Action template
    _bc_null_action() {
        return {
            'signal': this._bc_signal,
            'signal_radius': this._bc_signal_radius,
            'logs': this._bc_logs,
            'castle_talk': this._bc_castle_talk
        };
    }

    _bc_error_action(e) {
        var a = this._bc_null_action();
        
        if (e.stack) a.error = e.stack;
        else a.error = e.toString();

        return a;
    }

    _bc_action(action, properties) {
        var a = this._bc_null_action();
        if (properties) for (var key in properties) { a[key] = properties[key]; }
        a['action'] = action;
        return a;
    }

    _bc_check_on_map(x, y) {
        return x >= 0 && x < this._bc_game_state.shadow[0].length && y >= 0 && y < this._bc_game_state.shadow.length;
    }
    
    log(message) {
        this._bc_logs.push(JSON.stringify(message));
    }

    // Set signal value.
    signal(value, radius) {
        // Check if enough fuel to signal, and that valid value.

        if (this.fuel < radius) throw "Not enough fuel to signal given radius.";
        if (!Number.isInteger(value) || value < 0 || value >= Math.pow(2,SPECS.COMMUNICATION_BITS)) throw "Invalid signal, must be int within bit range.";
        if (radius > 2*Math.pow(SPECS.MAX_BOARD_SIZE-1,2)) throw "Signal radius is too big.";

        this._bc_signal = value;
        this._bc_signal_radius = radius;

        this.fuel -= radius;
    }

    // Set castle talk value.
    castleTalk(value) {
        // Check if enough fuel to signal, and that valid value.

        if (!Number.isInteger(value) || value < 0 || value >= Math.pow(2,SPECS.CASTLE_TALK_BITS)) throw "Invalid castle talk, must be between 0 and 2^8.";

        this._bc_castle_talk = value;
    }

    proposeTrade(karbonite, fuel) {
        if (this.me.unit !== SPECS.CASTLE) throw "Only castles can trade.";
        if (!Number.isInteger(karbonite) || !Number.isInteger(fuel)) throw "Must propose integer valued trade."
        if (Math.abs(karbonite) >= SPECS.MAX_TRADE || Math.abs(fuel) >= SPECS.MAX_TRADE) throw "Cannot trade over " + SPECS.MAX_TRADE + " in a given turn.";

        return this._bc_action('trade', {
            trade_fuel: fuel,
            trade_karbonite: karbonite
        });
    }

    buildUnit(unit, dx, dy) {
        if (this.me.unit !== SPECS.PILGRIM && this.me.unit !== SPECS.CASTLE && this.me.unit !== SPECS.CHURCH) throw "This unit type cannot build.";
        if (this.me.unit === SPECS.PILGRIM && unit !== SPECS.CHURCH) throw "Pilgrims can only build churches.";
        if (this.me.unit !== SPECS.PILGRIM && unit === SPECS.CHURCH) throw "Only pilgrims can build churches.";
        
        if (!Number.isInteger(dx) || !Number.isInteger(dx) || dx < -1 || dy < -1 || dx > 1 || dy > 1) throw "Can only build in adjacent squares.";
        if (!this._bc_check_on_map(this.me.x+dx,this.me.y+dy)) throw "Can't build units off of map.";
        if (this._bc_game_state.shadow[this.me.y+dy][this.me.x+dx] > 0) throw "Cannot build on occupied tile.";
        if (!this.map[this.me.y+dy][this.me.x+dx]) throw "Cannot build onto impassable terrain.";
        if (this.karbonite < SPECS.UNITS[unit].CONSTRUCTION_KARBONITE || this.fuel < SPECS.UNITS[unit].CONSTRUCTION_FUEL) throw "Cannot afford to build specified unit.";

        return this._bc_action('build', {
            dx: dx, dy: dy,
            build_unit: unit
        });
    }

    move(dx, dy) {
        if (this.me.unit === SPECS.CASTLE || this.me.unit === SPECS.CHURCH) throw "Churches and Castles cannot move.";
        if (!this._bc_check_on_map(this.me.x+dx,this.me.y+dy)) throw "Can't move off of map.";
        if (this._bc_game_state.shadow[this.me.y+dy][this.me.x+dx] === -1) throw "Cannot move outside of vision range.";
        if (this._bc_game_state.shadow[this.me.y+dy][this.me.x+dx] !== 0) throw "Cannot move onto occupied tile.";
        if (!this.map[this.me.y+dy][this.me.x+dx]) throw "Cannot move onto impassable terrain.";

        var r = Math.pow(dx,2) + Math.pow(dy,2);  // Squared radius
        if (r > SPECS.UNITS[this.me.unit]['SPEED']) throw "Slow down, cowboy.  Tried to move faster than unit can.";
        if (this.fuel < r*SPECS.UNITS[this.me.unit]['FUEL_PER_MOVE']) throw "Not enough fuel to move at given speed.";

        return this._bc_action('move', {
            dx: dx, dy: dy
        });
    }

    mine() {
        if (this.me.unit !== SPECS.PILGRIM) throw "Only Pilgrims can mine.";
        if (this.fuel < SPECS.MINE_FUEL_COST) throw "Not enough fuel to mine.";
        
        if (this.karbonite_map[this.me.y][this.me.x]) {
            if (this.me.karbonite >= SPECS.UNITS[SPECS.PILGRIM].KARBONITE_CAPACITY) throw "Cannot mine, as at karbonite capacity.";
        } else if (this.fuel_map[this.me.y][this.me.x]) {
            if (this.me.fuel >= SPECS.UNITS[SPECS.PILGRIM].FUEL_CAPACITY) throw "Cannot mine, as at fuel capacity.";
        } else throw "Cannot mine square without fuel or karbonite.";

        return this._bc_action('mine');
    }

    give(dx, dy, karbonite, fuel) {
        if (dx > 1 || dx < -1 || dy > 1 || dy < -1 || (dx === 0 && dy === 0)) throw "Can only give to adjacent squares.";
        if (!this._bc_check_on_map(this.me.x+dx,this.me.y+dy)) throw "Can't give off of map.";
        if (this._bc_game_state.shadow[this.me.y+dy][this.me.x+dx] <= 0) throw "Cannot give to empty square.";
        if (karbonite < 0 || fuel < 0 || this.me.karbonite < karbonite || this.me.fuel < fuel) throw "Do not have specified amount to give.";

        return this._bc_action('give', {
            dx:dx, dy:dy,
            give_karbonite:karbonite,
            give_fuel:fuel
        });
    }

    attack(dx, dy) {
        if (this.me.unit !== SPECS.CRUSADER && this.me.unit !== SPECS.PREACHER && this.me.unit !== SPECS.PROPHET) throw "Given unit cannot attack.";
        if (this.fuel < SPECS.UNITS[this.me.unit].ATTACK_FUEL_COST) throw "Not enough fuel to attack.";
        if (!this._bc_check_on_map(this.me.x+dx,this.me.y+dy)) throw "Can't attack off of map.";
        if (this._bc_game_state.shadow[this.me.y+dy][this.me.x+dx] === -1) throw "Cannot attack outside of vision range.";
        if (!this.map[this.me.y+dy][this.me.x+dx]) throw "Cannot attack impassable terrain.";
        if (this._bc_game_state.shadow[this.me.y+dy][this.me.x+dx] === 0) throw "Cannot attack empty tile.";

        var r = Math.pow(dx,2) + Math.pow(dy,2);
        if (r > SPECS.UNITS[this.me.unit]['ATTACK_RADIUS'][1] || r < SPECS.UNITS[this.me.unit]['ATTACK_RADIUS'][0]) throw "Cannot attack outside of attack range.";

        return this._bc_action('attack', {
            dx:dx, dy:dy
        });
        
    }


    // Get robot of a given ID
    getRobot(id) {
        if (id <= 0) return null;
        for (var i=0; i<this._bc_game_state.visible.length; i++) {
            if (this._bc_game_state.visible[i].id === id) {
                return insulate(this._bc_game_state.visible[i]);
            }
        } return null;
    }

    // Check if a given robot is visible.
    isVisible(robot) {
        return ('x' in robot);
    }

    // Check if a given robot is sending you radio.
    isRadioing(robot) {
        return robot.signal >= 0;
    }

    // Get map of visible robot IDs.
    getVisibleRobotMap() {
        return this._bc_game_state.shadow;
    }

    // Get boolean map of passable terrain.
    getPassableMap() {
        return this.map;
    }

    // Get boolean map of karbonite points.
    getKarboniteMap() {
        return this.karbonite_map;
    }

    // Get boolean map of impassable terrain.
    getFuelMap() {
        return this.fuel_map;
    }

    // Get a list of robots visible to you.
    getVisibleRobots() {
        return this._bc_game_state.visible;
    }

    turn() {
        return null;
    }
}

const constants = {
	num_workers : 5, //No of workers produced
	numkMeansIter : 10, //No of k means iterations
	microRadius : 50, //Radius to micro
	attackFuel: 500, //Amount of fuel at which we'll attack
	dirFuelSave: [[0,-1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]],
	dirFast: [[0,-1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, 2], [0, -2], [2, 0], [-2, 0]],
	dirReallyFast: [[0,-1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, 2], [0, -2], [2, 0], [-2, 0], 
	[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [-1, 2], [-1, -2], [1, -2], [2, 2], [2, -2], [-2, 2], [-2, -2], [3, 0],
	[-3, 0], [0, 3], [0, -3]],
};

/**
	This class provides shared methods for all unit classes
*/
class AbstractUnit{
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
				let robot = bc.getRobot(rob);
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

		//Only execute this on mobile units
		if (bc.me.unit != SPECS.CASTLE && bc.me.unit != SPECS.CHURCH){
			//Triggers attack mode when there is enough fuel
			if (bc.fuel >= constants.attackFuel){
				//bc.log("Entering attack mode");
				this.attack_mode = true;
			}
			//Begin assault, move towards nearest known castle
			if (this.attack_mode){
				if (this.shouldMicro(bc)){
					return this.microMove(bc);
				}
				else{
					//Checks if there is some move in the move queue
					if (this.actions.length == 0){
						//Request more actions to perform
						this.actions = this.makeMoveQueue(bc, bc.me.x, bc.me.y, this.enemy_castles);
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
							this.actions = this.makeMoveQueue(bc, bc.me.x, bc.me.y, this.enemy_castles);
							if (this.actions.length != 0){
								action = this.actions.splice(0, 1)[0];
								newPos = [bc.me.x + action[0], bc.me.y + action[1]];
								if (!this.isOccupied(bc, newPos[0], newPos[1])){
									return bc.move(action[0], action[1]);
								}
							}
							//Give up if unable to move
							bc.log("Gave up moving");
						}
					}
					bc.log("No valid move");
				}
			}
			else{
				if (this.shouldMicro(bc)){
					return this.microMove(bc);
				}
				//Do nothing if should not micro
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
		@return null if unreachable, array containing moves [dirx, diry] if reachable
	*/
	makeMoveQueue(bc, x, y, targets, dir = constants.dirFuelSave){
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
				if (rob > 0 && robot != null && (robot.unit == SPECS.CASTLE || robot.unit == SPECS.CHURCH)){
					continue;
				}
				moveGrid[newPos[1]][newPos[0]] = moveGrid[pos[1]][pos[0]] + 1;
				lastMoveGrid[newPos[1]][newPos[0]] = dir[i];
				visited[newPos[1]][newPos[0]] = true;
				queue.push([newPos[0], newPos[1]]);
				if (isTarget[newPos[1]][newPos[0]]){
					targetX = newPos[0];
					targetY = newPos[1];
					bc.log("Done. Exiting BFS");
					//bc.log("targetX: " + targetX + "targetY: " + targetY);
					break;
				}
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
		return this.isWithinRange(bc, other) && bc.fuel >= SPECS.UNITS[bc.me.unit].ATTACK_FUEL_COST;
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

/**
	This class provides methods specific to the crusader
*/

class Crusader extends AbstractUnit{
	/**
		Creates an instance of the abstract unit
		@param battleCode the main class provided by the battlecode source
	*/
	constructor(bc){
		super(bc);
	}

	takeTurn(bc){
		//Note: return this if it is not undefined
		let cmd = super.takeTurn(bc); //Perform any behaviour shared by all units before taking turn
		if (cmd){
			//bc.log("Following abstract unit command");
			return cmd;
		}
		/*const choices = [[0,-1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
        const choice = choices[Math.floor(Math.random()*choices.length)]
        return bc.move(...choice);*/
        /*if (this.shouldMicro(bc)){
        	//Perform micro move
        }
        else{
        	//Act normally
        	if (bc.fuel >= constants.attackFuel){
        		//TODO: Issue attack command on nearest castle
        	}
        	else{
        		//Do nothing
        	}
        }*/
	}

	/**
		@return an attack or move based on the micro
	*/
	microMove(bc){
		bc.log("Micro Moving");
		//TODO: Return an attack or move based on the micro
		//Naive: Attack anything in range
		let visibleRobots = bc.getVisibleRobots();
		let enemyRobots = [];
		for (let i = 0; i < visibleRobots.length; i++){
			let robot = visibleRobots[i];
			
			if (robot.team != bc.me.team && this.canAttack(bc, robot)){
				return bc.attack(robot.x - bc.me.x, robot.y - bc.me.y);
			}
			if (robot.team != bc.me.team){
				enemyRobots.push(visibleRobots[i]);
			}
		}
		let leastDist = 1000000000;
		let bestMove = 0;
		//Naive: Move to closest position to all visible enemy robots
		for (let i = 0; i < constants.dirReallyFast.length; i++){
			let dir = constants.dirReallyFast[i];
			if (this.isOccupied(bc, bc.me.x + dir[0], bc.me.y + dir[1])){
				continue;
			}
			let minDist = 1000000000;
			for (let j = 0; j < enemyRobots.length; j++){
				let robot = enemyRobots[j];
				let dist = this.distSquared([bc.me.x, bc.me.y],  [robot.x, robot.y]);
				minDist = Math.min(minDist, dist);
			}
			if (minDist < leastDist){
				minDist = leastDist;
				bestMove = i;
			}
		}
		return bc.move(constants.dirReallyFast[bestMove][0], constants.dirReallyFast[bestMove][1]);

	}


}

/**
	This class provides methods specific to the crusader
*/

class Castle extends AbstractUnit{
	/**
		Creates an instance of the abstract unit
		@param battleCode the main class provided by the battlecode source
	*/
	constructor(bc){
		super(bc);
		this.centroids = super.kMeansMulti(bc, constants.numkMeansIter, constants.num_workers);
	}

	takeTurn(bc){
		//bc.log("Fuel: " + bc.fuel);
		super.takeTurn(bc); //Perform any behaviour shared by all units before taking turn
		//Check whether can place of nearby tiles
		//Build crusader
		
		return this.buildUnit(bc, SPECS.CRUSADER);
		/*if (this.step % 10 === 0) { //Access superclass variables as if it were your own
            bc.log("Building a crusader at " + (bc.me.x+1) + ", " + (bc.me.y+1));
            return bc.buildUnit(SPECS.CRUSADER, 1, 1);
        } else {
            return // this.log("Castle health: " + this.me.health);
        }*/
	}

	buildUnit(bc, unitType, minKarbLeft = 0, minFuelLeft = 0){
		bc.log(`Building Unit (type:${unitType})`);
		if (!this.hasEnoughResources(bc, unitType, minKarbLeft, minFuelLeft)){
			return;
		}
		const dir = [[0,-1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
		for (let i = 0; i < dir.length; i++){
			//No resources, can't build unit
			
			let nx = bc.me.x + dir[i][0];
			let ny = bc.me.y + dir[i][1];
			if (!this.isOccupied(bc, nx, ny)){
				//Build a crusader all around me
				return bc.buildUnit(unitType, dir[i][0], dir[i][1]);
			}
		}
		bc.log("Could not place unit!!");
	}


}

class MyRobot extends BCAbstractRobot {
    constructor(){
        super();
        this.robot = null; //Initializes the robot object used to control this robot
    }

    turn() {
        //Check whether I'm in the queue of robots, create a new robot type if not
        if (this.robot == null){
            if (this.me.unit == SPECS.CRUSADER){
                this.robot = new Crusader(this);
            }
            else if (this.me.unit == SPECS.CASTLE){
                this.robot = new Castle(this);
            }
        }
        return this.robot.takeTurn(this);
    }
}

var robot = new MyRobot();
var robot = new MyRobot();
