'use strict';

const fetch = require('node-fetch');

module.exports = class LuchtmeetGrabber {

	constructor(opts) {
		this.lat = opts.lat;
		this.lon = opts.lon;
    this.homey = opts.homey;
    }
    
    async getClosedStation() {
      const locations = await this.getStations();
      this.homey.log(`Loaded ${locations.length} stations`);
      if (locations.length==0) return null;
      var closest=locations[0];
      var closest_distance=this.getDistanceFromLatLonInKm(closest.longitude,closest.latitude,this.lon,this.lat);
      for(var i=1;i<locations.length;i++){
        if(this.getDistanceFromLatLonInKm(locations[i].longitude,locations[i].latitude,this.lon,this.lat)<closest_distance){
            closest_distance=this.getDistanceFromLatLonInKm(locations[i].longitude,locations[i].latitude,this.lon,this.lat)
            closest=locations[i];
        }
      }
      return closest;
    }


  getDistanceFromLatLonInKm(lon1, lat1, lon2, lat2) {
      //console.log(`lon1 ${lon1} lat1 ${lat1} ;  lon2 ${lon2} lat2 ${lat2}`);
      var R = 6371; // Radius of the earth in km
      var dLat = this.deg2rad(lat2-lat1);  // deg2rad below
      var dLon = this.deg2rad(lon2-lon1); 
      var a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2)
        ; 
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
      var d = R * c; // Distance in km
      return d;
    }
    
  deg2rad(deg) {
      return deg * (Math.PI/180)
    } 
 
    async getStationLKIData(station){
      try {
        this.homey.log(`get LKI Data ${station}`);
        const res = await fetch(`https://api.luchtmeetnet.nl/open_api/lki?station_number=${station}&order_by=timestamp_measured&order_direction=desc`);
        if (!res.ok) this.homey.error(`The HTTP status of the response: ${res.status} (${res.statusText})`);
        const data = await res.json();
        return data
      } catch (error) {
          this.homey.error(`cannot connect to: https://api.luchtmeetnet.nl`);        
          return "{}"
      }
    }
    
    async getStationMeasurements(station) {

        this.homey.log(`getStationMeasurements for station : ${station}`);
        var stationDatas = await this.getStationLKIData(station);
       // console.log(stationDatas);
        if (stationDatas && stationDatas.data.length>0) {
            return stationDatas.data[0];
        } else
            return null;
    }

	async getStationPage(page){
      try {
        const res = await fetch(`https://api.luchtmeetnet.nl/open_api/stations?page=${page}&order_by=number&organisation_id=`);
        if (!res.ok) this.homey.error(`The HTTP status of the response: ${res.status} (${res.statusText})`);
        const data = await res.json();
        return data       
      } catch (error) {
        this.homey.error(`cannot connect to: https://api.luchtmeetnet.nl`);        
        return "{}"
      }
    }
    
    async getStationData(number){

        try {
            const res = await fetch(`https://api.luchtmeetnet.nl/open_api/stations/${number}/`);
            if (!res.ok) this.homey.error(`The HTTP status of the response: ${res.status} (${res.statusText})`);
            const data = await res.json(); 
            return { 
                number : number,
                longitude : data.data.geometry.coordinates[0],
                latitude :  data.data.geometry.coordinates[1],
                location : data.data.location,
                province : data.data.province
            }              
        } catch (error) {
           //this.homey.error(error);
            return { 
                number : number,
                longitude : 0,
                latitude :  0,
                location : '',
                province : ''
            } 
        } 
    }

	async getStations() {

        const me = this;
        
        var StationArray = [];    

        var stations = await me.getStationPage('');

        try {
          await asyncForEach(stations.pagination.page_list, async (page) => {
                  var stats = await me.getStationPage(page);        
                
                  me.homey.log(`Page number:${page}`);
                  await asyncForEach(stats.data,async station => {
                    StationArray.push(this.getStationData(station.number).then((result) => {
                          return result;
                    }));
                  });
          });         
        } catch (error) {
          
        }



        const results = await Promise.all(StationArray);
        return results;
     }
};

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
}

