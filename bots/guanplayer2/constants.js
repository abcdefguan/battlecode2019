import {SPECS} from 'battlecode';
export const constants = {
	//num_workers : 5, //No of workers produced
	//numkMeansIter : 10, //No of k means iterations
	microRadius : 125, //Radius to micro
	attackFuel: 750, //Amount of fuel at which we'll attack
	dirFuelSave: [[0,-1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]],
	dirFast: [[0,-1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, 2], [0, -2], [2, 0], [-2, 0]],
	dirReallyFast: [[0,-1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, 2], [0, -2], [2, 0], [-2, 0], 
	[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [-1, 2], [-1, -2], [1, -2], [2, 2], [2, -2], [-2, 2], [-2, -2], [3, 0],
	[-3, 0], [0, 3], [0, -3]],
	maxSignalRadius : 9, //Radius to be signalled by castles
	maxAlertRadius: 16, //Maximum radius to send an alert
	alertCooldown: 20, //Number of turns in which a new alert can be issued
	alertUnitType: SPECS.CRUSADER, //Unit type to be produced on alert
	karboniteReserve: 40, //Amt of karbonite reserved for alerts
};