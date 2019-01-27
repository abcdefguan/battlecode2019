/**
	This class provides methods specific to the crusader
*/
import {AbstractUnit} from 'abstract_unit.js';
import {SPECS} from 'battlecode';
import {constants} from 'constants.js';

export class Church extends AbstractUnit{
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
				if (signal == -1){
					//Ignore
				}
				else if (signal < 4096){
					bc.log(`Noted: Friendly Castle at (${Math.floor(signal / 64)}, ${signal % 64})`)
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
		bc.log(`My index is ${this.churchIdx}`)
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