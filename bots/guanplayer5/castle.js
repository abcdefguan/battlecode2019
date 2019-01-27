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
					bc.log(`Castle has detected enemy at (${this.spotted_enemy[0]}, ${this.spotted_enemy[1]})`)
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