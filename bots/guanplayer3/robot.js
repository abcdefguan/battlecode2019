import {BCAbstractRobot, SPECS} from 'battlecode';
import {Crusader} from 'crusader.js';
import {Castle} from 'castle.js';
import {Pilgrim} from 'pilgrim.js';

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
        }
        return this.robot.takeTurn(this);
    }
}

var robot = new MyRobot();