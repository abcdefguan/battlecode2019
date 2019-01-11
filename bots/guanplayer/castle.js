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
	}

	takeTurn(bc){
		super.takeTurn(bc); //Perform any behaviour shared by all units before taking turn
		//Check whether can place of nearby tiles
		//Build crusader
		this.buildUnit(bc, SPECS.CRUSADER);
		/*if (this.step % 10 === 0) { //Access superclass variables as if it were your own
            bc.log("Building a crusader at " + (bc.me.x+1) + ", " + (bc.me.y+1));
            return bc.buildUnit(SPECS.CRUSADER, 1, 1);
        } else {
            return // this.log("Castle health: " + this.me.health);
        }*/
	}

	buildUnit(bc, unitType, minKarbLeft = 0, minFuelLeft = 0){
		const dir = [[0,-1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
		for (let i = 0; i < dir.length; i++){
			let nx = bc.me.x + dir[i][0];
			let ny = bc.me.y + dir[i][1];
			if (!this.isOccupied(nx, ny) && this.hasEnoughResources(bc, minKarbLeft, minFuelLeft)){
				//Build a crusader all around me
				return bc.buildUnit(unitType, dir[i][0], dir[i][1]);
			}
		}
	}


}