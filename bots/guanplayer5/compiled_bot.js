'use strict';

var SPECS = {"COMMUNICATION_BITS":16,"CASTLE_TALK_BITS":8,"MAX_ROUNDS":1000,"TRICKLE_FUEL":25,"INITIAL_KARBONITE":100,"INITIAL_FUEL":500,"MINE_FUEL_COST":1,"KARBONITE_YIELD":2,"FUEL_YIELD":10,"MAX_TRADE":1024,"MAX_BOARD_SIZE":64,"MAX_ID":4096,"CASTLE":0,"CHURCH":1,"PILGRIM":2,"CRUSADER":3,"PROPHET":4,"PREACHER":5,"RED":0,"BLUE":1,"CHESS_INITIAL":100,"CHESS_EXTRA":20,"TURN_MAX_TIME":200,"MAX_MEMORY":50000000,"UNITS":[{"CONSTRUCTION_KARBONITE":null,"CONSTRUCTION_FUEL":null,"KARBONITE_CAPACITY":null,"FUEL_CAPACITY":null,"SPEED":0,"FUEL_PER_MOVE":null,"STARTING_HP":200,"VISION_RADIUS":100,"ATTACK_DAMAGE":10,"ATTACK_RADIUS":[1,64],"ATTACK_FUEL_COST":10,"DAMAGE_SPREAD":0},{"CONSTRUCTION_KARBONITE":50,"CONSTRUCTION_FUEL":200,"KARBONITE_CAPACITY":null,"FUEL_CAPACITY":null,"SPEED":0,"FUEL_PER_MOVE":null,"STARTING_HP":100,"VISION_RADIUS":100,"ATTACK_DAMAGE":0,"ATTACK_RADIUS":0,"ATTACK_FUEL_COST":0,"DAMAGE_SPREAD":0},{"CONSTRUCTION_KARBONITE":10,"CONSTRUCTION_FUEL":50,"KARBONITE_CAPACITY":20,"FUEL_CAPACITY":100,"SPEED":4,"FUEL_PER_MOVE":1,"STARTING_HP":10,"VISION_RADIUS":100,"ATTACK_DAMAGE":null,"ATTACK_RADIUS":null,"ATTACK_FUEL_COST":null,"DAMAGE_SPREAD":null},{"CONSTRUCTION_KARBONITE":15,"CONSTRUCTION_FUEL":50,"KARBONITE_CAPACITY":20,"FUEL_CAPACITY":100,"SPEED":9,"FUEL_PER_MOVE":1,"STARTING_HP":40,"VISION_RADIUS":49,"ATTACK_DAMAGE":10,"ATTACK_RADIUS":[1,16],"ATTACK_FUEL_COST":10,"DAMAGE_SPREAD":0},{"CONSTRUCTION_KARBONITE":25,"CONSTRUCTION_FUEL":50,"KARBONITE_CAPACITY":20,"FUEL_CAPACITY":100,"SPEED":4,"FUEL_PER_MOVE":2,"STARTING_HP":20,"VISION_RADIUS":64,"ATTACK_DAMAGE":10,"ATTACK_RADIUS":[16,64],"ATTACK_FUEL_COST":25,"DAMAGE_SPREAD":0},{"CONSTRUCTION_KARBONITE":30,"CONSTRUCTION_FUEL":50,"KARBONITE_CAPACITY":20,"FUEL_CAPACITY":100,"SPEED":4,"FUEL_PER_MOVE":3,"STARTING_HP":60,"VISION_RADIUS":16,"ATTACK_DAMAGE":20,"ATTACK_RADIUS":[1,16],"ATTACK_FUEL_COST":15,"DAMAGE_SPREAD":3}]};

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
        
        var fuelNeeded = Math.ceil(Math.sqrt(radius));
        if (this.fuel < fuelNeeded) throw "Not enough fuel to signal given radius.";
        if (!Number.isInteger(value) || value < 0 || value >= Math.pow(2,SPECS.COMMUNICATION_BITS)) throw "Invalid signal, must be int within bit range.";
        if (radius > 2*Math.pow(SPECS.MAX_BOARD_SIZE-1,2)) throw "Signal radius is too big.";

        this._bc_signal = value;
        this._bc_signal_radius = radius;

        this.fuel -= fuelNeeded;
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
        if (this.me.unit === SPECS.CHURCH) throw "Churches cannot attack.";
        if (this.fuel < SPECS.UNITS[this.me.unit].ATTACK_FUEL_COST) throw "Not enough fuel to attack.";
        if (!this._bc_check_on_map(this.me.x+dx,this.me.y+dy)) throw "Can't attack off of map.";
        if (this._bc_game_state.shadow[this.me.y+dy][this.me.x+dx] === -1) throw "Cannot attack outside of vision range.";

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
        return ('unit' in robot);
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
	//num_workers : 5, //No of workers produced
	//numkMeansIter : 10, //No of k means iterations
	microRadius : 125, //Radius to micro
	attackFuel: 750, //Amount of fuel at which we'll attack
	dirBuildChurch: [[0,0], [0,-1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]],
	dirFuelSave: [[0,-1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]],
	dirFast: [[0,-1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, 2], [0, -2], [2, 0], [-2, 0]],
	dirReallyFast: [[0,-1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, 2], [0, -2], [2, 0], [-2, 0], 
	[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [-1, 2], [-1, -2], [1, -2], [2, 2], [2, -2], [-2, 2], [-2, -2], [3, 0],
	[-3, 0], [0, 3], [0, -3]],
	maxSignalRadius : 100, //Radius to be signalled by castles
	maxAlertRadius: 100, //Maximum radius to send an alert
	alertCooldown: 20, //Number of turns in which a new alert can be issued
	alertUnitType: SPECS.PROPHET, //Unit type to be produced on alert
	karboniteReserve: 50, //Amt of karbonite reserved for alerts
	churchKarboniteReserve: 25, //Amt of karbonite reserved by churches
	defaultSpread: 8, //Default amt to spread out by
	noSignalFuel: 100, //Fuel level below which no signalling occurs
	noRobotFuel: 350, //Fuel level below which no robot production occurs
	criticalMass: 100, //Critical Mass of units at which an attack is ordered
	unitBelongRadius: 100, //Radius at which a unit is recorded as belonging to this particular castle
	spreadRatio: 0.3, //Ratio used to determine unit spread
	clusterRadius: 25, //Dist Squared at which to consider as a single mineral cluster, this can't be more than 100
	churchBuildTurn: 50, //Turn at which to build first church
	maxKarbonite: 500, //Do not mine when there's more than this karbonite
	noMineFuel: 250, //Fuel below which karbonite mining stops
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
		this.oddTiles = this.getOddTiles(bc);
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
		/*if (this.alert_cooldown <= 0){
			if (shouldMicro && this.spotted_enemy != null){
				bc.log(`Alerting enemy at (${this.spotted_enemy[0]},${this.spotted_enemy[1]})`)
				this.signalAlert(bc, 8192 + this.spotted_enemy[0] * 64 + this.spotted_enemy[1]);
				this.alert_cooldown = constants.alertCooldown;
			}
		}*/
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
					if (signal == -1);
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
						bc.log(`Received Alert at (${Math.floor(signal / 64)},${signal % 64})`);
						if (bc.me.unit != SPECS.PILGRIM){
							return this.moveToTarget(bc, [[Math.floor(signal / 64), signal % 64]])
						}
					}
				}
			}

			//bc.log(this.friendly_castles);
			//For attacking units only
			if (bc.me.unit != SPECS.PILGRIM && bc.me.unit != SPECS.PROPHET){
				/*if (bc.me.turn > 5 && this.enemy_castles.length == 1){
					bc.log("!! Did not receive signal !!");
				}*/
				/*if (bc.me.unit == SPECS.CRUSADER){
					bc.log(`There is ${bc.fuel}. I need ${constants.attackFuel}`)
				}*/
				//Triggers attack mode when there is enough fuel
				//Used to spread out
				/*if (bc.me.turn >= 3 && this.distSquared([bc.me.x, bc.me.y], [this.ownerCastle[0], this.ownerCastle[1]]) <= 4){
					//Move to somewhere random on a 4 move radius
					let tgt = this.spreadoutMove(bc, bc.me.x, bc.me.y);
					this.settlePos = tgt;
					//bc.log(`Spreading out to (${tgt[0]},${tgt[1]})`)
					if (tgt != null){
						return this.moveToTarget(bc, [tgt], constants.dirFuelSave, false);
					}
				}*/
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
			else if (bc.me.unit == SPECS.PROPHET){
				//Build lattice
				return this.spreadoutMove(bc);
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
			positions.push([enemyCastles[i][0], enemyCastles[i][1]]);
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

	getSafeDeposits(bc, enemyCastles, depositType = 0){
		let targets = [];
		for (let i = 0; i < bc.map.length; i++){
			for (let j = 0; j < bc.map[i].length; j++){
				let isSafe = true;
				for (let k = 0; k < enemyCastles.length; k++){
					let castle = enemyCastles[k];
					if (this.distSquared([j, i], castle) <= constants.clusterRadius){
						isSafe = false;
						break;
					}
				}
				if (!isSafe){
					continue;
				}
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

	getOwnedDeposits(bc, allDeposits){
		let myDeposits = []; //[[idx, pos]]
		//Get resource tiles that this church is in charge of
		for (let i = 0; i < allDeposits.length; i++){
			let deposit = allDeposits[i];
			if (this.distSquared(deposit, [bc.me.x, bc.me.y]) <= constants.clusterRadius){
				//Build 
				myDeposits.push([i, allDeposits[i]]);
			}
		}
		//Sort resource tiles by karbonite first, fuel second
		myDeposits.sort((target1, target2) => {
			let targetType1 = 1;
			if (bc.karbonite_map[target1[1][1]][target1[1][0]]){
				targetType1 = 0;
			}
			let targetType2 = 1;
			if (bc.karbonite_map[target2[1][1]][target2[1][0]]){
				targetType2 = 0;
			}
			if (targetType1 != targetType2){
				return targetType1 - targetType2;
			}
			else{
				//Compare by ID
				return target1[0] - target2[0];
			}
		});
		return myDeposits;
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

	getOddTiles(bc){
		let ans = [];
		for (let i = -20; i < 20; i++){
			for (let j = -20; j < 20; j++){
				let nx = this.ownerCastle[0] + i;
				let ny = this.ownerCastle[1] + j;
				if ((i + j) % 2 != 0){
					continue;
				}
				if (!this.isWithinMap(nx, ny) || bc.karbonite_map[ny][nx] || bc.fuel_map[ny][nx]){
					continue;
				}
				ans.push([nx, ny]);
			}
		}
		//bc.log(ans);
		return ans;
	}

	spreadoutMove(bc){
		//bc.log("Spreading Out");
		if ((bc.me.x - this.ownerCastle[0] + bc.me.y - this.ownerCastle[1]) % 2 == 0 
			&& !bc.karbonite_map[bc.me.y][bc.me.x] && !bc.fuel_map[bc.me.y][bc.me.x]){
			return;
		}

		if (this.actions.length == 0){
			//Request more actions to perform
			this.actions = this.makeMoveQueue(bc, bc.me.x, bc.me.y, this.oddTiles, constants.dirFuelSave, false);
		}
		/*bc.log(`I'm at ${bc.me.x},${bc.me.y}`)
		bc.log(`My castle is ${this.ownerCastle}`)
		bc.log(`My targets are: ${this.oddTiles}`)
		bc.log(`My actions are: ${this.actions}`)*/
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
				this.actions = this.makeMoveQueue(bc, bc.me.x, bc.me.y, this.oddTiles, constants.dirFuelSave, false);
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

	/*spreadoutMove(bc, x, y, numSpread = constants.defaultSpread, dir = constants.dirFuelSave){
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
	}*/

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
		bc.log(`Signalling Alert ${signal} at radius ${radius}`);
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
		for (let i = 0; i < robots.length; i++){
			let other = robots[i];
			let distSquared = this.distSquared([bc.me.x, bc.me.y], [other.x, other.y]);
			if (other.team != bc.me.team);
			if (other.team != bc.me.team && distSquared <= constants.microRadius){
				//bc.log("Nearest Enemy is too close");
				this.spotted_enemy = [other.x, other.y];
				this.spotted_enemy_type = other.unit;
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
		//bc.log("Micro Moving");
		//TODO: Return an attack or move based on the micro
		//Naive: Attack anything in range
		let visibleRobots = bc.getVisibleRobots();
		let enemyRobots = [];
		let bestTarget = -1;
		let bestScore = -1000000000;
		for (let i = 0; i < visibleRobots.length; i++){
			let robot = visibleRobots[i];
			
			if (robot.team != bc.me.team && this.canAttack(bc, robot)){
				//bc.log(`Attackable robot with ID ${robot.id}`)
				let score = this.getAttackScore(robot);
				if (score > bestScore){
					bestScore = score;
					bestTarget = i;
				}
				//return bc.attack(robot.x - bc.me.x, robot.y - bc.me.y);
			}
			if (robot.team != bc.me.team){
				enemyRobots.push(visibleRobots[i]);
			}
		}
		if (bestTarget != -1){
			let robot = visibleRobots[bestTarget];
			return bc.attack(robot.x - bc.me.x, robot.y - bc.me.y);
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
				let dist = this.distSquared([bc.me.x + dir[0], bc.me.y + dir[1]],  [robot.x, robot.y]);
				minDist = Math.min(minDist, dist);
			}
			//bc.log(`Move ${dir} has dist ${minDist}`);
			if (minDist < leastDist){
				leastDist = minDist;
				bestMove = i;
			}
		}
		return bc.move(constants.dirReallyFast[bestMove][0], constants.dirReallyFast[bestMove][1]);
	}

	getAttackScore(other){
		return other.id;
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
		//this.centroids = super.kMeansMulti(bc, constants.numkMeansIter, constants.num_workers);
		this.castle_id = -1; //Castle 1 => 1st castle, 2 => 2nd castle, 3 => 3rd castle
		this.other_castles = {}; //Represents locations of other castles
		this.signal_queue = []; //Queue to be used to signal units
		this.resource_pref = 1; //0 => both deposits, 1 => karbonite, 2 => fuel (Set this before building pilgrims), 3 => build church
		this.friendly_robots = {};
		this.allTargets = this.getDeposits(bc, 0); //A reference to every deposit
		this.myPilgrims = {}; //An object that tracks my pilgrims
		this.lastDepositId = -1; //To be set when making pilgrims (-1 when last pilgrim is not mining deposit)
		this.myDeposits = this.getOwnedDeposits(bc, this.allTargets);
	}

	takeTurn(bc){
		/*
			Guide to castle talk:
			0 - 64 => target x or y location (within first 5 turns)
			65 + targetIdx => Pilgrim and their targets
			253 => Normal Church
			254 => Under attack (Castle Only)
			255 => normal operation
		*/
		super.takeTurn(bc); //Perform any behaviour shared by all units before taking turn
		bc.log(`This is turn ${bc.me.turn}`);
		if (bc.me.turn == 1){
			this.friendly_castles = [[bc.me.x, bc.me.y]];
			//Read castle ID from other castles
			if (this.castle_id == -1){
				let highestCastleId = 0;
				let visibleRobots = this.visibleRobots;
				//bc.log(`${visibleRobots.length} visible robots`);
				for (let i = 0; i < visibleRobots.length; i++){
					let robot = visibleRobots[i];
					//bc.log(`robot at ${robot.x},${robot.y} of type ${robot.unit} on team ${robot.team} saying ${robot.castle_talk}`)
					if (robot.team == bc.me.team){
						let cid = robot.castle_talk;
						//bc.log(`cid is ${cid}`);
						highestCastleId = Math.max(highestCastleId, cid);
					}
				}
				this.castle_id = highestCastleId + 1;
			}
			//Share castle ID with other castles
			bc.log(`I am castle ${this.castle_id} at (${bc.me.x},${bc.me.y})`);
			bc.castleTalk(this.castle_id);
		}
		else if (bc.me.turn == 2){
			//Share location x coordinate with other castles
			bc.castleTalk(bc.me.x + 1);
		}
		else if (bc.me.turn == 3){
			//Share location x coordinate with other castles
			bc.castleTalk(bc.me.x + 1);
			//Read location x coordinate of other castles
			for (let i = 0; i < this.visibleRobots.length; i++){
				let robot = this.visibleRobots[i];
				if (robot.castle_talk > 0 && robot.castle_talk <= 64 && robot.id != bc.me.id){
					this.other_castles[robot.id] = {x: robot.castle_talk - 1};
				}
			}
		}
		else if (bc.me.turn == 4){
			//Share location y coordinate with other castles
			bc.castleTalk(bc.me.y + 1);
		}
		else if (bc.me.turn == 5){
			//Share location y coordinate with other castles
			bc.castleTalk(bc.me.y + 1);
			//bc.log("Other Castles");
			//bc.log(this.other_castles);
			//Read location y coordinate of other castles
			for (let i = 0; i < this.visibleRobots.length; i++){
				let robot = this.visibleRobots[i];
				if (robot.castle_talk > 0 && robot.castle_talk <= 64 && robot.id != bc.me.id){
					//Add to friendly castles
					this.other_castles[robot.id]["y"] = robot.castle_talk - 1;
					this.friendly_castles.push([this.other_castles[robot.id].x, robot.castle_talk - 1]);
				}
			}
			//Compute locations of enemy castles
			this.enemy_castles = this.getEnemyCastles(bc, this.friendly_castles);
			//Don't care about assignments, churches should be sorted by score
			this.churchPos = this.getChurchPositions(bc, this.friendly_castles, this.enemy_castles)[0];
			bc.log("Enemy castles predicted at: " + this.enemy_castles);
		}
		else{
			if (!this.should_micro){
				bc.castleTalk(255);
			}
			else{
				bc.castleTalk(254);
				if (this.spotted_enemy != null){
					bc.log(`Castle has detected enemy at (${this.spotted_enemy[0]}, ${this.spotted_enemy[1]})`);
				}
			}
		}
		//Update my pilgrims
		this.updatePilgrims(bc);
		//bc.log(this.myPilgrims);
		//Build Units here
		if (this.should_micro){
			//Can't build combat units after turn 5
			if (this.spotted_enemy_type == SPECS.PILGRIM){
				return this.attackNearestEnemy(bc);
			}
			if (bc.me.turn >= 5){
				//I'm currently on alert, should build units
				let action = this.buildUnit(bc, constants.alertUnitType);
				if (!action){
					return this.attackNearestEnemy(bc);
				}
				return action;
			}
		}
		else{
			//Check if I need to build pilgrims
			//Need at least 2 karbonite pilgrims, then need to cover all the deposits I own
			let minedDeposits = Object.values(this.myPilgrims);
			//bc.log("Mined Deposits: " + minedDeposits);
			let numKarbonitePilgrims = 0;
			for (let i = 0; i < minedDeposits.length; i++){
				let deposit = this.allTargets[minedDeposits[i]];
				//bc.log("Deposit: " + deposit);
				if (bc.karbonite_map[deposit[1]][deposit[0]]){
					numKarbonitePilgrims += 1;
				}
			}
			//bc.log("Num Karbonite: " + numKarbonitePilgrims)
			//Build 2 karbonite pilgrims
			if (numKarbonitePilgrims < 1){
				this.resource_pref = 1; //Karbonite Resource preference
				let action = this.buildUnit(bc, SPECS.PILGRIM, constants.churchKarboniteReserve);
				if (this.signal_queue.length > 0){
					let signal = this.signal_queue.splice(0, 1)[0];
					this.signalAllies(bc, signal);
				}
				return action;
			}
			//Check whether all owned deposits are mined
			let isDepositUnmined = false;
			//bc.log("My Deposits: " + this.myDeposits);
			//bc.log("Mined Deposits: " + minedDeposits);
			for (let i = 0; i < this.myDeposits.length; i++){
				let deposit = this.myDeposits[i][0];
				isDepositUnmined = true;
				for (let j = 0; j < minedDeposits.length; j++){
					if (deposit == minedDeposits[j]){
						isDepositUnmined = false;
						break;
					}
				}
				if (isDepositUnmined){
					break;
				}
			}
			bc.log("isDepositUnmined: " + isDepositUnmined);
			//bc.log("Are Some Deposits Not Mined?: " + isDepositUnmined);
			if (isDepositUnmined){
				this.resource_pref = 0;
				//bc.log("Building Pilgrim with fuel preference");
				let action = this.buildUnit(bc, SPECS.PILGRIM, constants.churchKarboniteReserve);
				if (this.signal_queue.length > 0){
					let signal = this.signal_queue.splice(0, 1)[0];
					this.signalAllies(bc, signal);
				}
				return action;
			}
			if (bc.me.turn >= 5){
				//Check if a church build is valid
				let churches = this.getChurches();
				for (let j = 0; j < this.churchPos.length; j++){
					if (!churches.hasOwnProperty(j)){
						//Am I the closest castle to this church
						let closestCastle = -1;
						let leastDist = 1000000000;
						for (let aa = 0; aa < this.friendly_castles.length; aa++){
							let castle = this.friendly_castles[aa];
							let distSquared = this.distSquared(this.churchPos[j], castle);
							if (distSquared <= leastDist){
								leastDist = distSquared;
								closestCastle = aa;
							}
						}
						//Self must be the closest castle in order to build
						if (closestCastle != 0){
							bc.log("not closest castle, closest castle is " + closestCastle);
							break;
						}
						this.resource_pref = 3;
						let action = this.buildUnit(bc, SPECS.PILGRIM, constants.churchKarboniteReserve);
						if (this.signal_queue.length > 0){
							let signal = this.signal_queue.splice(0, 1)[0];
							this.signalAllies(bc, signal);
						}
						return action;
					}
				}
			}
			//Build attack units if all else fails
			let action = this.buildUnit(bc, SPECS.PROPHET, constants.karboniteReserve, constants.noRobotFuel);
			if (this.signal_queue.length > 0){
				let signal = this.signal_queue.splice(0, 1)[0];
				this.signalAllies(bc, signal);
			}
			return action;
		}
	}

	buildUnit(bc, unitType, minKarbLeft = 0, minFuelLeft = 0){
		if (!this.hasEnoughResources(bc, unitType, minKarbLeft, minFuelLeft)){
			return;
		}
		bc.log(`Building Unit (type:${unitType})`);
		const dir = [[0,-1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
		for (let i = 0; i < dir.length; i++){
			//No resources, can't build unit
			let nx = bc.me.x + dir[i][0];
			let ny = bc.me.y + dir[i][1];
			if (unitType == SPECS.PILGRIM){
				if (!this.isOccupied(bc, nx, ny)){
					if (this.resource_pref == 3){
						//An order to build a church
						//Listen to all churches
						let churches = this.getChurches();
						for (let j = 0; j < this.churchPos.length; j++){
							if (!churches.hasOwnProperty(j)){
								//Am I the closest castle to this church
								/*let closestCastle = -1;
								let leastDist = 1000000000;
								for (let aa = 0; aa < this.friendly_castles.length; aa++){
									let castle = this.friendly_castles[aa];
									let distSquared = this.distSquared(this.churchPos[j], castle);
									if (distSquared <= leastDist){
										leastDist = distSquared;
										closestCastle = aa;
									}
								}
								//Self must be the closest castle in order to build
								if (closestCastle != 0){
									bc.log("not closest castle, closest castle is " + closestCastle);
									return;
								}*/
								//Build church with ID j
								this.lastDepositId = -1;
								for (let j = 1; j < this.friendly_castles.length; j++){
									let castle = this.friendly_castles[j];
									this.signal_queue.unshift(castle[0] * 64 + castle[1]);
								}
								this.signal_queue.unshift(12288 + j);
								return bc.buildUnit(unitType, dir[i][0], dir[i][1]);
							}
						}
					}
					else{
						//An order to mine a certain resource tile
						//TODO: Compute mining target
						let targetIdx = -1;
						let allTargets = this.allTargets;
						let legitTargets = this.getUnminedDeposits(bc, this.resource_pref);
						//Can't build unit, no remaining targets left
						if (legitTargets.length == 0){
							bc.log("All mining targets are taken");
							return;
						}
						//bc.log(legitTargets);
						let target = this.makeMoveQueue(bc, bc.me.x, bc.me.y, legitTargets, constants.dirFuelSave, false, true)[0];
						//bc.log(`Target: ${target}`);
						//bc.log(`Legit Targets: ${legitTargets}`);
						for (let j = 0; j < allTargets.length; j++){
							if (allTargets[j][0] == target[0] && allTargets[j][1] == target[1]){
								targetIdx = j;
								break;
							}
						}
						if (targetIdx == -1){
							bc.log("Could not reach any mining targets");
							return;
						}
						bc.log("Building Pilgrim, target: " + targetIdx);
						this.lastDepositId = targetIdx;
						//bc.log(`Signalling index ${targetIdx} to pilgrim`);
						this.signal_queue.unshift(4096 + targetIdx);
						//bc.log(this.signal_queue);
						return bc.buildUnit(unitType, dir[i][0], dir[i][1]);
					}
				}
			}
			else{
				if (!this.isOccupied(bc, nx, ny)){
					//Add all other castles to signal queue
					for (let j = 1; j < this.friendly_castles.length; j++){
						let castle = this.friendly_castles[j];
						this.signal_queue.push(castle[0] * 64 + castle[1]);
					}
					//Build a crusader all around me
					return bc.buildUnit(unitType, dir[i][0], dir[i][1]);
				}
			}
		}
		bc.log("Could not place unit!!");
	}

	attackNearestEnemy(bc){
		for (let i = 0; i < this.visibleRobots.length; i++){
			let other = this.visibleRobots[i];
			if (other.team != bc.me.team && this.canAttack(bc, other)){
				bc.log(`Castle is attacking enemy at (${other.x},${other.y})`);
				return bc.attack(other.x - bc.me.x, other.y - bc.me.y);
			}
		}
	}

	signalAllies(bc, signal){
		/*
			Guide to signals:
			< 4096 => Allied castle location signal (x * 64 + y)
			4096 - 8191 => signal - 4096 is the location on resource array to gather at
			8192 - 12288 => Alert signal, signal - 8192 is the location on map where an attack is reported
			12288 - 16383 => Used to convey church index to new churches, also used to convey build church order to pilgrims
		*/
		let radius = 2;
		if (signal < 4096){
			for (let i = 0; i < this.visibleRobots.length; i++){
				let robot = this.visibleRobots[i];
				if (robot.unit == SPECS.CASTLE || robot.unit == SPECS.PILGRIM || robot.unit == SPECS.CHURCH){
					continue;
				}
				if (robot.x == null || robot.y == null){
					continue;
				}
				let distSquared = this.distSquared([bc.me.x, bc.me.y], [robot.x, robot.y]);
				radius = Math.max(radius, Math.min(distSquared, constants.maxSignalRadius));
			}
		}
		else if (signal < 8192){
			radius = 2;
		}
		else if (signal >= 12288 && signal < 16383){
			radius = 2;
		}
		bc.log(`Signalling ${signal} at radius ${radius}`);
		if (radius == 0){
			return;
		}
		bc.signal(signal, radius);
	}

	updatePilgrims(bc){
		let newPilgrims = {};
		//bc.log("Last Deposit ID: " + this.lastDepositId);
		for (let i = 0; i < this.visibleRobots.length; i++){
			let robot = this.visibleRobots[i];
			if (robot.unit != SPECS.PILGRIM){
				continue;
			}
			if (!this.myPilgrims.hasOwnProperty(robot.id)){
				//bc.log(`Has new pilgrim at ${this.distSquared([robot.x, robot.y], [bc.me.x, bc.me.y])}, deposit ID is ${this.lastDepositId}`);
				if (this.distSquared([robot.x, robot.y], [bc.me.x, bc.me.y]) <= 9 && this.lastDepositId != -1){
					newPilgrims[robot.id] = this.lastDepositId;
				}
			}
			else{
				newPilgrims[robot.id] = this.myPilgrims[robot.id];
			}
		}
		this.myPilgrims = newPilgrims;
	}

	getMiningDeposits(){
		let miningDeposits = [];
		for (let j = 0; j < this.visibleRobots.length; j++){
			let robot = this.visibleRobots[j];
			if (robot.castle_talk >= 65 && robot.castle_talk < this.allTargets.length + 65){
				miningDeposits.push(this.allTargets[robot.castle_talk - 65]);
			}
		}
		return miningDeposits;
	}

	getUnminedDeposits(bc, resource_pref = 0){
		let unminedDeposits = this.getDeposits(bc, this.resource_pref);//this.getSafeDeposits(bc, this.enemy_castles, this.resource_pref);
		let miningDeposits = this.getMiningDeposits();
		//Remove excluded targets from legit targets
		for (let j = 0; j < unminedDeposits.length; j++){
			for (let a = 0; a < miningDeposits.length; a++){
				if (unminedDeposits[j][0] == miningDeposits[a][0] && unminedDeposits[j][1] == miningDeposits[a][1]){
					unminedDeposits.splice(j,1);
					j--;
					break;
				}
			}
		}
		return unminedDeposits;
	}

	getChurches(){
		//Returns a church object with church IDs
		let churches = {};
		for (let i = 0; i < this.visibleRobots.length; i++){
			let robot = this.visibleRobots[i];
			if (robot.castle_talk >= 220 && robot.castle_talk <= 253){
				churches[253 - robot.castle_talk] = 1;
			}
		}
		return churches;
	}


}

/**
	This class provides methods specific to the crusader
*/

class Pilgrim extends AbstractUnit{
	/**
		Creates an instance of the abstract unit
		@param battleCode the main class provided by the battlecode source
	*/
	constructor(bc){
		super(bc);
		let visibleRobots = bc.getVisibleRobots();
		this.allTargets = this.getDeposits(bc);
		this.ownerCastle = [0, 0]; //Should not be this value, should be defined as some other value
		this.shouldBuildChurch = false;
		this.hasBuiltChurch = false;
		this.builtChurchTurn = 0;
		this.churchId = 0;
		for (let i = 0; i < visibleRobots.length; i++){
			let robot = visibleRobots[i];
			//bc.log(this.distSquared([bc.me.x, bc.me.y], [robot.x, robot.y]));
			if ((robot.unit == SPECS.CASTLE || robot.unit == SPECS.CHURCH) && robot.team == bc.me.team && this.distSquared([bc.me.x, bc.me.y], [robot.x, robot.y]) <= 2){
				this.ownerCastle = [robot.x, robot.y];
				if (robot.unit == SPECS.CASTLE){
					this.addFriendlyCastle(this.ownerCastle);
				}
				bc.log(`Owner castle is at (${robot.x},${robot.y})`);
				if (robot.signal >= 4096 && robot.signal < 8192){
					this.targetIdx = robot.signal - 4096;
					bc.log(`Target index is ${robot.signal - 4096}`);
					bc.log(`Attempt mine at ${this.allTargets[this.targetIdx]}`);
					this.targets = [this.allTargets[this.targetIdx]];
				}
				else if (robot.signal >= 12288 && robot.signal < 16384){
					this.shouldBuildChurch = true;
					this.churchId = robot.signal - 12288;
				}
				//bc.log(`Owner castle says ${robot.signal}`);
				
				break;
			}
		}
		this.homeTiles = [];
		for (let i = 0; i < constants.dirFuelSave.length; i++){
			let dir = constants.dirFuelSave[i];
			let nx = this.ownerCastle[0] + dir[0];
			let ny = this.ownerCastle[1] + dir[1];
			//bc.log(nx);
			//bc.log(ny);
			if (this.isWithinMap(nx, ny)){
				this.homeTiles.push([nx, ny]);
			}
		}
		//bc.log("Home tiles");
		//bc.log(this.homeTiles);
		//this.centroids = super.kMeansMulti(bc, constants.numkMeansIter, constants.num_workers);
	}

	takeTurn(bc){
		//Would not make a move off of super's take turn
		super.takeTurn(bc);
		
		//bc.log(this.targets);
		//bc.log(bc.karbonite_map[bc.me.y][bc.me.x]);
		if (this.shouldBuildChurch){
			//bc.log(`I'm building church at ID ${this.churchId}`);

			bc.castleTalk(253 - this.churchId);
			//TODO: Build church at appropriate position
			//Wait while friendly and enemy castles are updated by abstract unit
			if (bc.me.turn == 4){
				this.churches = this.getChurchPositions(bc, this.friendly_castles, this.enemy_castles);
				this.churchPos = this.churches[0][this.churchId];
				this.churchDeposits = this.churches[1][this.churchId];
				this.churchTiles = [];
				for (let i = 0; i < constants.dirFuelSave.length; i++){
					let dir = constants.dirFuelSave[i];
					let nx = this.churchPos[0] + dir[0];
					let ny = this.churchPos[1] + dir[1];
					//bc.log(nx);
					//bc.log(ny);
					if (this.isWithinMap(nx, ny)){
						this.churchTiles.push([nx, ny]);
					}
				}
			}
			if (bc.me.turn >= 4){
				bc.log("Friendly Castles: " + this.friendly_castles);
				//TODO: If I'm adjacent to the church, build it, then convert me to a mining pilgrim
				if (this.distSquared(this.churchPos, [bc.me.x, bc.me.y]) <= 2){
					if (!this.hasBuiltChurch && this.hasEnoughResources(bc, SPECS.CHURCH)){
						if (this.isOccupied(bc, this.churchPos[0], this.churchPos[1])){
							//Build church elsewhere
							for (let i = 0; i < constants.dirFuelSave.length; i++){
								let nx = bc.me.x + constants.dirFuelSave[i][0];
								let ny = bc.me.y + constants.dirFuelSave[i][1];
								//bc.log("nx: " + nx + "ny: " + ny);
								if (!this.isOccupied(bc,nx,ny)){
									this.hasBuiltChurch = true;
									this.builtChurchTurn = bc.me.turn;
									//Signal Church ID
									bc.signal(12288 + this.churchId, 2);
									return bc.buildUnit(SPECS.CHURCH, nx - bc.me.x, ny - bc.me.y);
								}
							}
						}
						this.hasBuiltChurch = true;
						this.builtChurchTurn = bc.me.turn;
						//Signal Church ID
						bc.signal(12288 + this.churchId, 2);
						return bc.buildUnit(SPECS.CHURCH, this.churchPos[0] - bc.me.x, this.churchPos[1] - bc.me.y);
					}
					else if (this.hasBuiltChurch){
						if (bc.me.turn - this.builtChurchTurn <= this.friendly_castles.length){
							let castle = this.friendly_castles[bc.me.turn - this.builtChurchTurn - 1];
							//Signal friendly castle location
							bc.signal(castle[0] * 64 + castle[1], 2);
							//Done signalling info, become a mining pilgrim
							if (bc.me.turn - this.builtChurchTurn == this.friendly_castles.length){
								this.shouldBuildChurch = false;
								//Get resource tiles church is in charge of
								let churchTargets = this.getOwnedDeposits(bc, this.allTargets);
								this.ownerCastle = this.churchPos;
								this.targets = [this.allTargets[churchTargets[0][0]]];
								this.targetIdx = churchTargets[0][0];
								this.homeTiles = [];
								for (let i = 0; i < constants.dirFuelSave.length; i++){
									let dir = constants.dirFuelSave[i];
									let nx = this.ownerCastle[0] + dir[0];
									let ny = this.ownerCastle[1] + dir[1];
									//bc.log(nx);
									//bc.log(ny);
									if (this.isWithinMap(nx, ny)){
										this.homeTiles.push([nx, ny]);
									}
								}
								//bc.log("Church Targets");
								//bc.log(churchTargets);
								//Change owner
								//bc.log("Converting to mining unit. Mining at target: " + this.targetIdx);
							}

						}
					}
					//TODO: Build church, signal info to church, then become a mining pilgrim
				}
				else{
					//Move to church build location
					return this.moveToTarget(bc, this.churchTiles);
				}
			}
			
		}
		else{
			//Broadcast a castle message detailing I'm a pilgrim and my target index
			//bc.log(`My target index is ${this.targetIdx}`)
			bc.castleTalk(65 + this.targetIdx);
			//Stop mining karbonite if too much karbonite or too little fuel
			if (bc.karbonite_map[this.targets[0][1]][this.targets[0][0]] && (bc.karbonite > constants.maxKarbonite || bc.fuel < constants.noMineFuel)){
				return;
			}
			if (bc.me.karbonite >= SPECS.UNITS[bc.me.unit].KARBONITE_CAPACITY || bc.me.fuel >= SPECS.UNITS[bc.me.unit].FUEL_CAPACITY){
				//bc.log("Full of karbonite!!");
				//bc.log(this.ownerCastle);
				//If I'm adjacent to a castle, give karbonite to the castle
				if (this.distSquared([bc.me.x, bc.me.y], [this.ownerCastle[0], this.ownerCastle[1]]) <= 2){
					return bc.give(this.ownerCastle[0] - bc.me.x, this.ownerCastle[1] - bc.me.y, bc.me.karbonite, bc.me.fuel);
				}
				//I'm full, todo: return to base
				let action = this.moveToTarget(bc, this.homeTiles, constants.dirFast, false);
				//bc.log(this.actions);
				return action;
			}
			else{
				//If I'm already on a karbonite deposit, mine it
				if (bc.me.x == this.targets[0][0] && bc.me.y == this.targets[0][1]){
					//bc.log("Mining!!!");
					return bc.mine();
				}
				//Greedily go to nearest mineral deposit
				let move = this.moveToTarget(bc, this.targets, constants.dirFast, false);
				if (move){
					return move;
				}
			}
		}
		//}
		//TODO: Compute arrangements non naively (using breadth first search instead of via raw distance)
		//TODO: Compute arrangements then harvest resources from correct section of map
		//TODO: Maintain targets array with list of resource harvesting targets
		//Find a new move if none available

		//Do nothing, for now
	}

	microMove(bc){
		bc.log("Microing (Not implemented)");
		//TODO: Flee from enemies
	}


}

/**
	This class provides methods specific to the crusader
*/

class Prophet extends AbstractUnit{
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
		//TODO: Return an attack or move based on the micro
		//Naive: Attack anything in range
		let visibleRobots = bc.getVisibleRobots();
		let enemyRobots = [];
		let bestTarget = -1;
		let bestScore = -1000000000;
		for (let i = 0; i < visibleRobots.length; i++){
			let robot = visibleRobots[i];
			
			if (robot.team != bc.me.team && this.canAttack(bc, robot)){
				//bc.log(`Attackable robot with ID ${robot.id}`)
				let score = this.getAttackScore(bc, robot);
				if (score > bestScore){
					bestScore = score;
					bestTarget = i;
				}
				//return bc.attack(robot.x - bc.me.x, robot.y - bc.me.y);
			}
			if (robot.team != bc.me.team){
				enemyRobots.push(visibleRobots[i]);
			}
		}
		if (bestTarget != -1){
			let robot = visibleRobots[bestTarget];
			return bc.attack(robot.x - bc.me.x, robot.y - bc.me.y);
		}
		bestScore = -1000000000;
		let bestMove = 0;
		//Naive: Move to closest position to all visible enemy robots
		for (let i = 0; i < constants.dirFast.length; i++){
			let dir = constants.dirFast[i];
			if (this.isOccupied(bc, bc.me.x + dir[0], bc.me.y + dir[1])){
				continue;
			}
			let score = 0;
			for (let j = 0; j < enemyRobots.length; j++){
				let robot = enemyRobots[j];
				if (this.isWithinRange(bc, robot)){
					if (robot.type != SPECS.PROPHET){
						score += (100 - this.distSquared([bc.me.x, bc.me.y], [robot.x, robot.y])) * 1000;
					}
					else{
						score -= 100;
					}
				}
			}
			//bc.log(`Move ${dir} has dist ${minDist}`);
			if (score > bestScore){
				bestScore = score;
				bestMove = i;
			}
		}
		return bc.move(constants.dirFast[bestMove][0], constants.dirFast[bestMove][1]);
	}

	getAttackScore(bc, other){
		//Attack closest and highest ID
		let distScore = (100 - this.distSquared([bc.me.x, bc.me.y], [other.x, other.y])) * 100;
		if (other.unit == SPECS.PROPHET){
			distScore += 1000000;
		}
		else if (other.unit == SPECS.CRUSADER || other.unit == SPECS.PREACHER){
			distScore += 500000;
		}
		else if (other.unit == SPECS.CASTLE){
			distScore += 250000;
		}
		return distScore + other.id;
	}


}

/**
	This class provides methods specific to the crusader
*/

class Church extends AbstractUnit{
	/**
		Creates an instance of the abstract unit
		@param battleCode the main class provided by the battlecode source
	*/
	constructor(bc){
		super(bc);
		//this.centroids = super.kMeansMulti(bc, constants.numkMeansIter, constants.num_workers);
		this.signal_queue = []; //Queue to be used to signal units
		this.resource_pref = 1; //0 => both deposits, 1 => karbonite, 2 => fuel (Set this before building pilgrims)
		this.allTargets = this.getDeposits(bc, 0); //A reference to every deposit
		//Get idx from pilgrim, used to communicate status
		this.churchIdx = 0;
		for (let i = 0; i < this.visibleRobots.length; i++){
			let robot = this.visibleRobots[i];
			if (robot.unit == SPECS.PILGRIM && this.distSquared([robot.x, robot.y], [bc.me.x, bc.me.y]) <= 2
				&& robot.signal != -1){
				this.churchIdx = robot.signal - 12288; //Signal with 12288 added to it
			}
		}
		this.myTargets = this.getOwnedDeposits(bc, this.allTargets);
		//bc.log("On Init Targets");
		//bc.log(this.myTargets)
		this.myPilgrims = {}; //Maps each robot ID to its target resource tile
		this.lastDepositId = this.myTargets[0][0]; //To be set whenever making a pilgrim, set to 0 because first pilgrim will mine deposit 0
		//TODO: Harvest karbonite before fuel tiles
	}

	takeTurn(bc){
		/*
			Guide to castle talk:
			0 - 64 => target x or y location (within first 5 turns)
			64 + targetIdx => pilgrims with their target IDs
			253 - targetIdx (> 220) => Normal Church with their position IDs
			254 => Under attack (Castle Only)
			255 => normal operation
		*/
		super.takeTurn(bc); //Perform any behaviour shared by all units before taking 
		let newPilgrims = {};
		//Read any messages to update friendly castle positions
		for (let i = 0; i < this.visibleRobots.length; i++){
			let robot = this.visibleRobots[i];
			//Read messages from pilgrims
			if (robot.team == bc.me.team && robot.unit == SPECS.PILGRIM){
				let signal = robot.signal;
				//Castle signal
				//bc.log(`Read signal ${signal}`);
				if (signal == -1);
				else if (signal < 4096){
					bc.log(`Noted: Friendly Castle at (${Math.floor(signal / 64)}, ${signal % 64})`);
					//Multiply / Divide by 64 to store info
					let newCastle = [Math.floor(signal / 64), signal % 64];
					this.addFriendlyCastle(newCastle);
					this.enemy_castles = this.getEnemyCastles(bc, this.friendly_castles);
				}
				if (!this.myPilgrims.hasOwnProperty(robot.id)){
					newPilgrims[robot.id] = this.lastDepositId;
				}
				else{
					newPilgrims[robot.id] = this.myPilgrims[robot.id];
				}
			}
		}
		//bc.log(this.friendly_castles)
		this.myPilgrims = newPilgrims;
		//Castle talk to indicate church and status
		bc.log(`My index is ${this.churchIdx}`);
		bc.castleTalk(253 - this.churchIdx);
		if (this.should_micro){
			if (bc.me.turn <= 20){
				return this.buildUnit(bc, SPECS.PREACHER);
			}
			//I'm currently on alert, should build units
			return this.buildUnit(bc, constants.alertUnitType);
		}
		else{
			this.validTargets = [];
			let harvestedTargets = Object.values(this.myPilgrims);
			//bc.log("Harvested Targets");
			//bc.log(harvestedTargets);
			//bc.log("My Targets");
			//bc.log(this.myTargets);
			for (let i = 0; i < this.myTargets.length; i++){
				let isValid = true;
				for (let j = 0; j < harvestedTargets.length; j++){
					if (this.myTargets[i][0] == harvestedTargets[j]){
						isValid = false;
						break;
					}
				}
				if (isValid){
					this.validTargets.push(this.myTargets[i]);
				}
			}
			let unitBuildType = SPECS.PILGRIM;
			if (this.validTargets.length == 0){
				//Build prophets
				unitBuildType = SPECS.PROPHET;
			}
			//Build pilgrim, if not build prophet
			let action = null;
			if (unitBuildType == SPECS.PILGRIM){
				action = this.buildUnit(bc, unitBuildType, constants.churchKarboniteReserve);
			}
			else{
				action = this.buildUnit(bc, unitBuildType, constants.karboniteReserve, constants.noRobotFuel);
			}
			if (this.signal_queue.length > 0){
				let signal = this.signal_queue.splice(0, 1)[0];
				this.signalAllies(bc, signal);
			}
			return action;
		}
	}

	buildUnit(bc, unitType, minKarbLeft = 0, minFuelLeft = 0){
		if (!this.hasEnoughResources(bc, unitType, minKarbLeft, minFuelLeft)){
			return;
		}
		bc.log(`Building Unit (type:${unitType})`);
		const dir = [[0,-1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
		for (let i = 0; i < dir.length; i++){
			//No resources, can't build unit
			let nx = bc.me.x + dir[i][0];
			let ny = bc.me.y + dir[i][1];
			if (unitType == SPECS.PILGRIM){
				if (!this.isOccupied(bc, nx, ny)){
					//TODO: Compute mining target
					let targetIdx = this.validTargets[0][0];
					this.lastDepositId = targetIdx;
					this.signal_queue.unshift(4096 + targetIdx);
					return bc.buildUnit(unitType, dir[i][0], dir[i][1]);
				}
			}
			else{
				if (!this.isOccupied(bc, nx, ny)){
					//Add all friendly castles to signal queue
					for (let j = 0; j < this.friendly_castles.length; j++){
						let castle = this.friendly_castles[j];
						this.signal_queue.push(castle[0] * 64 + castle[1]);
					}
					//Build a unit all around me
					return bc.buildUnit(unitType, dir[i][0], dir[i][1]);
				}
			}
		}
		bc.log("Could not place unit!!");
	}

	signalAllies(bc, signal){
		/*
			Guide to signals:
			< 4096 => Allied castle location signal (x * 64 + y)
			4096 - 8191 => signal - 4096 is the location on resource array to gather at
			8192 - 12287 => Alert signal, signal - 8192 is the location on map where an attack is reported
			12288 - 16383 => Used to convey church index to new churches, also used to convey build church order to pilgrims
		*/
		let radius = 1;
		if (signal < 4096){
			for (let i = 0; i < this.visibleRobots.length; i++){
				let robot = this.visibleRobots[i];
				if (robot.unit == SPECS.CASTLE || robot.unit == SPECS.PILGRIM || robot.unit == SPECS.CHURCH){
					continue;
				}
				if (robot.x == null || robot.y == null){
					continue;
				}
				let distSquared = this.distSquared([bc.me.x, bc.me.y], [robot.x, robot.y]);
				radius = Math.max(radius, Math.min(distSquared, constants.maxSignalRadius));
			}
		}
		else if (signal < 8192){
			radius = 2;
		}
		bc.log(`Church Signalling ${signal} at radius ${radius}`);
		if (radius == 0){
			return;
		}
		bc.signal(signal, radius);
	}


}

/**
	This class provides methods specific to the crusader
*/

class Preacher extends AbstractUnit{
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
		//TODO: Return an attack or move based on the micro
		//Naive: Attack anything in range
		let visibleRobots = bc.getVisibleRobots();
		let enemyRobots = [];
		let bestTarget = [-1, -1];
		let bestScore = -1000000000;
		for (let i = 0; i < visibleRobots.length; i++){
			let robot = visibleRobots[i];
			
			if (robot.team != bc.me.team){
				for (let j = -1; j <= 1; j++){
					for (let k = -1; k <= 1; k++){
						let nx = robot.x + j;
						let ny = robot.y + k;
						let other = {x: nx, y: ny};
						if (this.isWithinRange(bc,other)){
							let score = this.getAttackScore(bc, other);
							if (score > bestScore){
								bestScore = score;
								bestTarget = [nx, ny];
							}
						}
					}
				}
				//bc.log(`Attackable robot with ID ${robot.id}`)
				
				//return bc.attack(robot.x - bc.me.x, robot.y - bc.me.y);
			}
			if (robot.team != bc.me.team){
				enemyRobots.push(visibleRobots[i]);
			}
		}
		if (bestTarget[0] != -1){
			return bc.attack(bestTarget[0] - bc.me.x, bestTarget[1] - bc.me.y);
		}
		/*bestScore = -1000000000;
		let leastDist = 1000000000;
		let bestMove = 0;
		//Naive: Move to closest position to all visible enemy robots
		for (let i = 0; i < constants.dirFast.length; i++){
			let dir = constants.dirReallyFast[i];
			if (this.isOccupied(bc, bc.me.x + dir[0], bc.me.y + dir[1])){
				continue;
			}
			let minDist = 1000000000;
			for (let j = 0; j < enemyRobots.length; j++){
				let robot = enemyRobots[j];
				let dist = this.distSquared([bc.me.x + dir[0], bc.me.y + dir[1]],  [robot.x, robot.y]);
				minDist = Math.min(minDist, dist);
			}
			//bc.log(`Move ${dir} has dist ${minDist}`);
			if (minDist < leastDist){
				leastDist = minDist;
				bestMove = i;
			}
		}
		return bc.move(constants.dirFast[bestMove][0], constants.dirFast[bestMove][1]);*/
	}

	getAttackScore(bc, other){
		let score = 0;
		for (let i = -1; i <= 1; i++){
			for (let j = -1; j <= 1; j++){
				let nx = other.x + i;
				let ny = other.y + j;
				if (this.robomap[ny][nx] > 0){
					let robot = bc.getRobot(this.robomap[ny][nx]);
					let mult = 1;
					if (robot != null){
						if (robot.team == bc.me.team){
							mult = -1;
						}
					}
					if (other.unit == SPECS.PROPHET){
						score += mult * 1000000;
					}
					else if (other.unit == SPECS.CRUSADER || other.unit == SPECS.PREACHER){
						score += mult * 500000;
					}
					else if (other.unit == SPECS.CASTLE || other.unit == SPECS.CHURCH){
						score += mult * 250000;
					}
					else if (other.unit == SPECS.PILGRIM){
						score += mult * 1000;
					}
				}
			}
		}
		return score;
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
            else if (this.me.unit == SPECS.PILGRIM){
                this.robot = new Pilgrim(this);
            }
            else if (this.me.unit == SPECS.PROPHET){
                this.robot = new Prophet(this);
            }
            else if (this.me.unit == SPECS.CHURCH){
                this.robot = new Church(this);
            }
            else if (this.me.unit == SPECS.PREACHER){
                this.robot = new Preacher(this);
            }
        }
        return this.robot.takeTurn(this);
    }
}

var robot = new MyRobot();
var robot = new MyRobot();
