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
				bc.log("Friendly Castles: " + this.friendly_castles)
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
									bc.signal(12288 + this.churchId, 2)
									return bc.buildUnit(SPECS.CHURCH, nx - bc.me.x, ny - bc.me.y);
								}
							}
						}
						this.hasBuiltChurch = true;
						this.builtChurchTurn = bc.me.turn;
						//Signal Church ID
						bc.signal(12288 + this.churchId, 2)
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
		bc.log("Microing (Not implemented)")
		//TODO: Flee from enemies
	}


}