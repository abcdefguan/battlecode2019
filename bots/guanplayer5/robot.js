import {BCAbstractRobot, SPECS} from 'battlecode';
import {Crusader} from 'crusader.js';
import {Castle} from 'castle.js';
import {Pilgrim} from 'pilgrim.js';
import {Prophet} from 'prophet.js';
import {Church} from 'church.js';
import {Preacher} from 'preacher.js';

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
            else if (this.me.unit == SPECS.PROPHET){
                this.robot = new Prophet(this);
            }
            else if (this.me.unit == SPECS.CHURCH){
                this.robot = new Church(this);
            }
            else if (this.me.unit == SPECS.PREACHER){
                this.robot = new Preacher(this);
            }
        }
        return this.robot.takeTurn(this);
    }
}

var robot = new MyRobot();