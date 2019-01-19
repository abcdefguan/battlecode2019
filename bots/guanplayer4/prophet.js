/**
	This class provides methods specific to the crusader
*/
import {AbstractUnit} from 'abstract_unit.js';
import {SPECS} from 'battlecode';
import {constants} from 'constants.js';

export class Prophet extends AbstractUnit{
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
		return distScore + other.id;
	}


}