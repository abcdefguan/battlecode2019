/**
	This class provides methods specific to the crusader
*/
import {AbstractUnit} from 'abstract_unit.js';
import {SPECS} from 'battlecode';
import {constants} from 'constants.js';

export class Pilgrim extends AbstractUnit{
	/**
		Creates an instance of the abstract unit
		@param battleCode the main class provided by the battlecode source
	*/
	constructor(bc){
		super(bc);
		let visibleRobots = bc.getVisibleRobots();
		this.allTargets = this.getDeposits(bc);
		this.ownerCastle = [0, 0]; //Should not be this value, should be defined as some other value
		for (let i = 0; i < visibleRobots.length; i++){
			let robot = visibleRobots[i];
			bc.log(this.distSquared([bc.me.x, bc.me.y], [robot.x, robot.y]));
			if ((robot.unit == SPECS.CASTLE || robot.unit == SPECS.CHURCH) && robot.team == bc.me.team && this.distSquared([bc.me.x, bc.me.y], [robot.x, robot.y]) <= 2){
				this.ownerCastle = [robot.x, robot.y];
				bc.log(`Owner castle is at (${robot.x},${robot.y})`);
				//bc.log(`Owner castle says ${robot.signal}`);
				this.targetIdx = robot.signal - 4096;
				bc.log(`Target index is ${robot.signal - 4096}`);
				this.targets = [this.allTargets[this.targetIdx]];
				break;
			}
		}
		//this.centroids = super.kMeansMulti(bc, constants.numkMeansIter, constants.num_workers);
	}

	takeTurn(bc){
		//Would not make a move off of super's take turn
		super.takeTurn(bc);
		//Broadcast a castle message detailing I'm a pilgrim and my target index
		//bc.log(this.targets);
		//bc.castleTalk(64 + this.targetIdx);
		//bc.log(bc.karbonite_map[bc.me.y][bc.me.x]);
		/*if (this.shouldMicro(bc)){
			this.microMove(bc);
		}
		else {*/
		if (bc.me.karbonite >= SPECS.UNITS[bc.me.unit].KARBONITE_CAPACITY || bc.me.fuel >= SPECS.UNITS[bc.me.unit].FUEL_CAPACITY){
			//bc.log("Full of karbonite!!");
			//bc.log(this.ownerCastle);
			//If I'm adjacent to a castle, give karbonite to the castle
			if (this.distSquared([bc.me.x, bc.me.y], [this.ownerCastle[0], this.ownerCastle[1]]) <= 2){
				return bc.give(this.ownerCastle[0] - bc.me.x, this.ownerCastle[1] - bc.me.y, bc.me.karbonite, bc.me.fuel);
			}
			//I'm full, todo: return to base
			return this.moveToTarget(bc, [this.ownerCastle], constants.dirFast, false);
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
		//}
		//TODO: Compute arrangements non naively (using breadth first search instead of via raw distance)
		//TODO: Compute arrangements then harvest resources from correct section of map
		//TODO: Maintain targets array with list of resource harvesting targets
		//Find a new move if none available

		//Do nothing, for now
	}

	microMove(bc){
		bc.log("Microing (Not implemented)")
		//TODO: Flee from enemies
	}


}