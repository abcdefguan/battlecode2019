/**
	This class provides methods specific to the crusader
*/
import {AbstractUnit} from 'abstract_unit.js';
import {SPECS} from 'battlecode';
import {constants} from 'constants.js';

export class Crusader extends AbstractUnit{
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