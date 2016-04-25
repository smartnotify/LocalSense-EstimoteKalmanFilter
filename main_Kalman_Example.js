/*jslint node:true, vars:true, bitwise:true, unparam:true */
/*jshint unused:true */


var SmartNotify = require('./smartnotify.js');
var bHasSentAlert = false;
var Bleacon = require('bleacon');
var ibeaconCache = new Array();

var KalmanFilter = require('kalmanjs').default;
var kalmanFilter = new KalmanFilter({R: 0.01, Q: 20});
var counter = 1;  
var beaconMeasurement = [
    [],
    []
];

var lastDistance =0;
var hasSentAlert = 0;

//Setting up the server side
var express = require('express');
var app = express();

var http = require('http').Server(app);
var io = require('socket.io')(http);

var bleaconName = "";

app.get('/', function(req, res){
    res.sendFile(__dirname +'/index.html');
    //res.send('');
});

app.use(express.static(__dirname + '/Public'));


io.on('connection', function(socket){
    try{
     
    socket.on('SmartRequest', function(msg){
//Do something when the socket is connected. In our case we send a message.
    });
    io.emit('message', "0");
    socket.on('disconnect', function(){
     //console.log('user disconnected');
  });
    }
    catch (errSocket) {
     console.log("Socket error: " + errSocket.message);   
    }
});

var dataStream ={
            "Status" : 0,
            "Msg": "I'm good",
            "Point": 0
           }
SmartNotify.smartNotifyCheckIn (dataStream);


http.listen(3000, function(){
  console.log('listening on *:3000');
    
});
Bleacon.on('discover', function(bleacon) {
  
//if (bleacon.proximity=='immediate' || bleacon.proximity=='near'){
    // ==> This would be  a way to iterate through the beacons.  Not that interesting in our case!
    var guid = bleacon.uuid + bleacon.major + bleacon.minor;
    
//Could be enhanced a lot to track on multiple filters obviously
   if (guid=="b9407f30f5f8466eaff925556b57fe6d2541021240"){
     bleaconName="21240"; //Yes, hard coded and arbitrary :)
       
   
    var measuredPower = bleacon.measuredPower; 
    var rssi = bleacon.rssi;
    var proximity = bleacon.proximity;   
    var distance = findDistance(rssi, measuredPower);
   
// the RSSI  is all over the place so need to do some smoothing.  It can be improved lots and 
// lots but will do as a start.
//GIS to the rescue!  https://en.wikipedia.org/wiki/Kalman_filter   http://jsfiddle.net/Cnj8s/68/
//npm install kalmanjs
//https://www.npmjs.com/package/kalmanjs
        
    var dataExponential = Array.apply(null, {length: 1}).map(function(e, i) {
  //return Math.pow(1.1, i);
     return distance;
});     
        

    var dataExponentialKalman = dataExponential.map(function(v) {
  return kalmanFilter.filter(v);
});
        
       counter ++;
        beaconMeasurement.push(dataExponentialKalman);
          
        if (counter==4){
            var countTotal=0
            for (var i=0; i<beaconMeasurement.length;i++){
                countTotal = parseFloat(countTotal) + 0 + parseFloat(beaconMeasurement[i]);
            }
            countTotal = parseFloat(countTotal)/parseFloat(counter);
            //reset
            
            beaconMeasurement = [];
            console.log ("Total for: " + guid + " : " + countTotal);
            console.log ("Difference: " + (parseFloat(lastDistance) - parseFloat(countTotal)));
            io.emit('beaconLocator', guid,bleaconName,countTotal);
            lastDistance = countTotal;
            
            if (countTotal>0.5 && !bHasSentAlert){
                 var dataStream ={
                    "Status" : 7500,
                    "Msg":"Sensor is "+countTotal+" meters (aprox) away from device.",
                    "Point": countTotal
                   };
              
            //SmartNotify.smartNotifyRecordEvent (dataStream);
            bHasSentAlert=true;
            }
            counter = 1;     
        }    
     
 }   
    
});//end on discover

Bleacon.startScanning();
 


function findDistance(rssi, txPower) {  // See http://stackoverflow.com/questions/20416218/understanding-ibeacon-distancing/20434019#20434019
    //https://community.estimote.com/hc/en-us/articles/201636913-What-are-Broadcasting-Power-RSSI-and-other-characteristics-of-beacon-s-signal-
  
//txPower = -59 //hard coded power value. Usually ranges between -59 to -65 actually use the estimote sent data.
  
  if (rssi == 0) {
    return -1.0; 
  }

  var ratio = rssi*1.0/txPower;
  if (ratio < 1.0) {
    return Math.pow(ratio,10);
  }
  else {
    var distance =  (0.89976)*Math.pow(ratio,7.7095) + 0.111;       //This number could be improved upon greatly. See Stack entry
    return distance;
  }
} 