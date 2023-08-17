'use strict';

const Homey = require('homey');
const LuchtmeetGrabber = require('./LuchtmeetGrabber.js');

const MINUTE = 60000;



class AirQuality extends Homey.App {
	
	async onInit() {
		this.log(`${this.homey.manifest.id} V${this.homey.manifest.version} is running...`);

		await this.registerTokes();

		this.initFlows();

		this.stationData = {
            "timestamp_measured": "2019-05-26T00:00:00+00:00",
            "value": 0,
            "formula": "LKI",
            "station_number": "NL00000"
        }

		await this.registerLuchtmeetGrabber();
		this.homey.geolocation.on('location', this.registerLuchtmeetGrabber.bind(this));

		this.station = await this.lm_api.getClosedStation();

		this.log(this.station);

		this.startSyncing();

	}

	async registerTokes(){
		 this.LKIToken =  await this.homey.flow.createToken( 'lkitoken', {
			type: 'number',
			title: this.homey.__("lki")
		}).catch(err => {this.error( err )});
        await this.LKIToken.setValue(0);

		this.lastLKIUpdateToken =  await this.homey.flow.createToken( 'lastLKIUpdateToken', {
			type: 'string',
			title: this.homey.__("LastUpdateLKI")
		}).catch(err => {this.error( err )});
		this.lastLKIUpdateToken.setValue('1970-01-01 00:00:00');
	}

	initFlows() {
		this.lki3Trigger = this.homey.flow.getTriggerCard('lki3');
		this.lki6Trigger = this.homey.flow.getTriggerCard('lki6');
		this.lki8Trigger = this.homey.flow.getTriggerCard('lki8');
		this.lki10Trigger = this.homey.flow.getTriggerCard('lki10');
		this.lki12Trigger = this.homey.flow.getTriggerCard('lki12');
		this.lkiTrigger = this.homey.flow.getTriggerCard('lkitrigger');
		this.lkiTrigger.registerRunListener(async (args, state) => {return true;});
	}

	async registerLuchtmeetGrabber() {
		const latitude = this.homey.geolocation.getLatitude();
		const longitude = this.homey.geolocation.getLongitude();

		this.log(`Long ${longitude}  lat ${latitude}`);

		this.lm_api = new LuchtmeetGrabber({ lat: latitude, lon: longitude, homey: this.homey });
	}

	async startSyncing() {
		// Prevent more than one syncing cycle.
		if (this.isSyncing) return;

		// Start syncing.
		this.log('starting sync');
		this.poll();
	}


	async poll() {

		let me = this;
		// Check if it is raining at this moment
		this.isSyncing = true;
		this.log("polling ...");
		if (this.station) {
			try {
				let prevStationData = this.stationData;
				this.stationData = await this.lm_api.getStationMeasurements(this.station.number);
				if (this.stationData) {
					if (prevStationData)
					{
						if (prevStationData.value!==this.stationData.value) {
							await this.LKIToken.setValue(this.stationData.value).catch(err => {this.error( err )});
							// do some triggering
							let i = Number(this.stationData.value);
	
							this.log(`LKI Value: ${i}`);
							
							await this.lkiTrigger.trigger({
								'lki': i
							}).catch( this.error);
							
							switch (true) {
								case i<=3:
									//  Goed
									await this.lki3Trigger.trigger().catch( this.error );
									this.log('Goed');
									break;
								case i<=6:
									// Matig
									await this.lki6Trigger.trigger().catch( this.error );
									this.log('Matig');
									break;
								case i<=8:
									// Onvoldoende
									await this.lki8Trigger.trigger().catch( this.error );
									this.log('Onvoldoende');
									break;
								case i<=10:
									// Slecht
									await this.lki10Trigger.trigger().catch( this.error );
									this.log('Slecht');
									break;
								case i<12:
									// Zeer slecht
									await this.lki12Trigger.trigger().catch( this.error );
									this.log('Zeer Slecht');
									break;
								default:
									break;
							}
						}
					} else {
						await this.LKIToken.setValue(Number(this.stationData.value)).catch(err => {this.error( err )});
					}
					let ds = this.stationData.timestamp_measured.slice(0, 19).replace('T', ' ');
					this.log(ds);
					await this.lastLKIUpdateToken.setValue(ds).catch(err => {this.error( err )});
				}
			} catch (error) {
				this.error(error);
			}

		}

		this.isSyncing = false;

		// Schedule next sync.
		this.timeout = setTimeout(
			() => this.poll(),
			30 * MINUTE,
		);
		this.log('Polling done. Waiting 30 minutes for next pol');
	}

}

module.exports = AirQuality;