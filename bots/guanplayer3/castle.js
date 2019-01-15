/**
	This class provides methods specific to the crusader
*/
import {AbstractUnit} from 'abstract_unit.js';
import {SPECS} from 'battlecode';
import {constants} from 'constants.js';

export class Castle extends AbstractUnit{
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
		this.resource_pref = 1; //0 => both deposits, 1 => karbonite, 2 => fuel (Set this before building pilgrims)
		this.friendly_robots = {};
		this.allTargets = this.getDeposits(bc, 0); //A reference to every deposit
	}

	takeTurn(bc){
		/*
			Guide to castle talk:
			0 - 64 => target x or y location (within first 5 turns)
			254 => Under attack
			255 => normal operation
		*/
		super.takeTurn(bc); //Perform any behaviour shared by all units before taking turn
		bc.log(`This is turn ${bc.me.turn}`);
		let canSignal = false;
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
				if (robot.castle_talk > 0 && robot.id != bc.me.id){
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
			bc.log(this.other_castles);
			//Read location y coordinate of other castles
			for (let i = 0; i < this.visibleRobots.length; i++){
				let robot = this.visibleRobots[i];
				if (robot.castle_talk > 0 && robot.id != bc.me.id){
					//Add to friendly castles
					this.other_castles[robot.id]["y"] = robot.castle_talk - 1;
					this.friendly_castles.push([this.other_castles[robot.id].x, robot.castle_talk - 1]);
				}
			}
			//Compute locations of enemy castles
			this.enemy_castles = this.getEnemyCastles(bc, this.friendly_castles);
			bc.log("Enemy castles predicted at: " + this.enemy_castles);
			canSignal = true;
		}
		else{
			canSignal = true;
			if (!this.should_micro){
				bc.castleTalk(255);
			}
			else{
				bc.castleTalk(254);
				if (this.spotted_enemy != null){
					bc.log(`Castle has detected enemy at (${this.spotted_enemy[0]}, ${this.spotted_enemy[1]})`)
				}
			}
			let castleDestroyed = false;
			let hasAlertCastle = false;
			//Contingency if castle has been destroyed
			if (bc.me.turn == 7){
				let numCastles = 0;
				for (let i = 0; i < this.visibleRobots.length; i++){
					let robot = this.visibleRobots[i];
					if (robot.team == bc.me.team && robot.castle_talk >= 250){
						numCastles += 1;
					}
					if (robot.castle_talk == 254 && robot.id != bc.me.id){
						hasAlertCastle = true;
					}
				}
				if (numCastles < this.friendly_castles.length){
					castleDestroyed = true;
					bc.log("A Castle has been destroyed");
				}
			}
			if (this.should_micro){
				//I'm currently on alert, should produce crusaders
				return this.buildUnit(bc, constants.alertUnitType);
			}
			else{
				//Check if some other castle is on alert, don't build if some other castle is on alert
				if (!hasAlertCastle){
					//Look thru all detectable friendly units to get unit count
					for (let i = 0; i < this.visibleRobots.length; i++){
						let robot = this.visibleRobots[i];
						if (robot.team == bc.me.team){
							this.friendly_robots[robot.id] = 1;
						}
					}
					let num_units = Object.keys(this.friendly_robots).length - this.friendly_castles.length;
					let num_pilgrims = this.getMiningDeposits().length;
					//Spawn units here
					let next_build_unit = this.getNextBuildUnit(num_units, this.friendly_castles.length);
					//Switch harvest preference here
					//First two pilgrims karbonite only
					if (num_pilgrims <= 1){
						this.resource_pref = 1; //karbonite only
					}
					else{
						//Next two pilgrims anything
						this.resource_pref = 0; //both
					}
					/*if (bc.fuel <= 250){
						this.resource_pref = 2; //fuel only
					}
					else{
						if (num_pilgrims % 3 == 2){
							this.resource_pref = 2; //fuel only
						}
						else{
							this.resource_pref = 1; //karbonite only
						}
					}*/
					bc.log(`We has ${bc.karbonite} karbonite and ${bc.fuel} fuel. Next unit at castle ${next_build_unit[1]}`);
					//Need to be robust, override requirement for specific castle if turn is > 15 and we have > 30 karbonite
					if (next_build_unit[1] == this.castle_id || castleDestroyed || (bc.karbonite > 60 && bc.fuel > 750)){
						//Build the relevant unit, then signal
						//Reserve 40 karbonite in case of attack
						let action = this.buildUnit(bc, next_build_unit[0], constants.karboniteReserve);
						if (canSignal && this.signal_queue.length > 0){
							let signal = this.signal_queue.splice(0, 1)[0];
							this.signalAllies(bc, signal);
						}
						return action;
					}
				}
			}
		}
	}

	initBuildQueue(numCastles){
		//4 pilgrim opener
		if (numCastles == 1){
			return [[SPECS.PILGRIM, 1], [SPECS.PILGRIM, 1], [SPECS.PILGRIM, 1], [SPECS.PILGRIM, 1]];
		}
		else if (numCastles == 2){
			return [[SPECS.PILGRIM, 1], [SPECS.PILGRIM, 2], [SPECS.PILGRIM, 1], [SPECS.PILGRIM, 2]];
		}
		else{
			return [[SPECS.PILGRIM, 1], [SPECS.PILGRIM, 2], [SPECS.PILGRIM, 3], [SPECS.PILGRIM, 1]];
		}
	}

	getNextBuildQueue(numCastles){
		//This is to be called when initial units are exhausted
		//3:1 crusader:pilgrim ratio (Should be adjusted)
		if (numCastles == 1){
			return [[SPECS.CRUSADER, 1], [SPECS.CRUSADER, 1], [SPECS.CRUSADER, 1], [SPECS.PILGRIM, 1]];
		}
		else if (numCastles == 2){
			return [[SPECS.CRUSADER, 1], [SPECS.CRUSADER, 2], [SPECS.CRUSADER, 1], [SPECS.PILGRIM, 1],
			[SPECS.CRUSADER, 2], [SPECS.CRUSADER, 1], [SPECS.CRUSADER, 2], [SPECS.PILGRIM, 2]];
		}
		else if (numCastles == 3){
			return [[SPECS.CRUSADER, 1], [SPECS.CRUSADER, 2], [SPECS.CRUSADER, 3], [SPECS.PILGRIM, 1],
			[SPECS.CRUSADER, 1], [SPECS.CRUSADER, 2], [SPECS.CRUSADER, 3], [SPECS.PILGRIM, 2],
			[SPECS.CRUSADER, 1], [SPECS.CRUSADER, 2], [SPECS.CRUSADER, 3], [SPECS.PILGRIM, 3]];
		}
	}

	getNextBuildUnit(idx, numCastles){
		let bq = this.initBuildQueue(numCastles);
		let bnext = this.getNextBuildQueue(numCastles);
		if (idx < bq.length){
			return bq[idx];
		}
		else{
			return bnext[(idx - bq.length) % bnext.length];
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
					let targetIdx = -1;
					let allTargets = this.allTargets;
					let legitTargets = this.getUnminedDeposits(bc, this.resource_pref);
					//Can't build unit, no remaining targets left
					if (legitTargets.length == 0){
						bc.log("All mining targets are taken");
						return;
					}
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
					bc.log(`Signalling index ${targetIdx} to pilgrim`);
					this.signal_queue.unshift(4096 + targetIdx);
					bc.log(this.signal_queue);
					return bc.buildUnit(unitType, dir[i][0], dir[i][1]);
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

	signalAllies(bc, signal){
		/*
			Guide to signals:
			< 4096 => Allied castle location signal (x * 64 + y)
			4096 - 8191 => signal - 4096 is the location on resource array to gather at
			8192 - 12288 => Alert signal, signal - 8192 is the location on map where an attack is reported
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
		bc.log(`Signalling ${signal} at radius ${radius}`);
		if (radius == 0){
			return;
		}
		bc.signal(signal, radius);
	}

	getMiningDeposits(){
		let miningDeposits = [];
		for (let j = 0; j < this.visibleRobots.length; j++){
			let robot = this.visibleRobots[j];
			if (robot.castle_talk >= 64 && robot.castle_talk < this.allTargets.length + 64){
				miningDeposits.push(this.allTargets[robot.castle_talk - 64]);
			}
		}
		return miningDeposits;
	}

	getUnminedDeposits(bc, resource_pref = 0){
		let unminedDeposits = this.getDeposits(bc, this.resource_pref);
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


}