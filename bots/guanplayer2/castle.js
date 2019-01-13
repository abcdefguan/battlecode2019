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
		this.centroids = super.kMeansMulti(bc, constants.numkMeansIter, constants.num_workers);
		this.castle_id = -1; //Castle 1 => 1st castle, 2 => 2nd castle, 3 => 3rd castle
		this.other_castles = {}; //Represents locations of other castles
		this.signal_queue = []; //Queue to be used to signal units
	}

	takeTurn(bc){
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
					this.friendly_castles.push([this.other_castles[robot.id].x, robot.castle_talk - 1]);
				}
			}
			//Compute locations of enemy castles
			this.enemy_castles = this.getEnemyCastles(bc, this.friendly_castles);
			bc.log("Enemy castles predicted at: " + this.enemy_castles);
		}
		else{
			canSignal = true;
		}
		//TODO: Share locations of friendly castles with units
		//Check whether can place of nearby tiles
		//Build crusader, but only at first castle
		if (bc.me.turn >= 2 && this.castle_id == 1){
			let action = this.buildUnit(bc, SPECS.CRUSADER);
			if (canSignal && this.signal_queue.length > 0){
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
		bc.log("Could not place unit!!");
	}

	signalAllies(bc, signal){
		/*
			Guide to signals:
			< 4096 => Allied castle location signal (x * 64 + y)
		*/
		let radius = 0;
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
		bc.log(`Signalling ${signal} at radius ${radius}`);
		if (radius == 0){
			return;
		}
		bc.signal(signal, radius);
	}


}