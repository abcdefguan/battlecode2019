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
	maxSignalRadius : 100, //Radius to be signalled by castles
	maxAlertRadius: 100, //Maximum radius to send an alert
	alertCooldown: 20, //Number of turns in which a new alert can be issued
	alertUnitType: SPECS.PROPHET, //Unit type to be produced on alert
	karboniteReserve: 50, //Amt of karbonite reserved for alerts
	defaultSpread: 3, //Default amt to spread out by
	noSignalFuel: 250, //Fuel level below which no signalling occurs
	criticalMass: 7, //Critical Mass of units at which an attack is ordered
	unitBelongRadius: 100, //Radius at which a unit is recorded as belonging to this particular castle
	spreadRatio: 0.3, //Ratio used to determine unit spread
};