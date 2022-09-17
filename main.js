/* jshint -W097 */// jshint strict:false
/* jslint node: true */
"use strict";

const utils = require('@iobroker/adapter-core');

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file
// name excluding extension
// adapter will be restarted automatically every time as the configuration
// changed, e.g system.adapter.mobile-alerts.0
let adapter;
function startAdapter(options) {
  options = options || {};
  Object.assign(options, {
       name: 'sawtooth',
       ready: main,
       unload: callback => {
	       	try {
			adapter.log.debug('cleaned everything up...');
			callback();
		} catch (e) {
			callback();
		}
       }
       
  });

  adapter = new utils.Adapter(options);
  return adapter;
}

async function main() {
	adapter.log.info(" **** sawtooth adapter started ****");
	
	// processing each individial sawtooth:
	var list = adapter.config.list;

	for (var i=0; i<list.length;i++) {
		processSawtooth(list[i]);
    }
	adapter.log.info(" **** sawtooth adapter finished ****");
	adapter.terminate ? adapter.terminate() :process.exit(0);
}

function processSawtooth(item) {
    adapter.log.info(" Processing "+item.techname);
    var states=[
        {name:'currentValue'},
        {name:'minValue'},
        {name:'maxValue'},
        {name:'increment'},
        {name:'reset'},
        {name:'resetMode'},
        {name:'lastValue'},
        {name:'readOnly'}
    ];
    readNextState(item,states,0);
}

async function createSawtooth(item,el) {
        adapter.log.info(" ** createSawtooth");
        
        await adapter.setObjectNotExistsAsync(item.techname, {
            type: 'device',
            common: {
                name: item.description
            },
            native: {}
        });

        if (el=="currentValue") {
            await adapter.setObjectNotExistsAsync(item.techname+'.'+el, {
                type: 'state',
                common: {
                    name: 'Current  Value',
                    type: 'number',
                    role: 'value',
                    read: true,
                    write: true,
                    desc: 'Current sawtooth Value'
                },
                native: {}
            });
            adapter.setState(item.techname+'.'+el, {val : 0,ack : true});
        }

        if (el=="minValue") {
            await adapter.setObjectNotExistsAsync(item.techname+'.'+el, {
                type: 'state',
                common: {
                    name: 'Minimum  Value',
                    type: 'number',
                    role: 'value',
                    read: true,
                    write: true,
                    desc: 'Minimum allowed Value'
                },
                native: {val : 0,ack : true}
            });
            adapter.setState(item.techname+'.'+el, {val : 0,ack : true});
        }

        if (el=="maxValue") {
            await adapter.setObjectNotExistsAsync(item.techname+'.'+el, {
                type: 'state',
                common: {
                    name: 'Maximum Value',
                    type: 'number',
                    role: 'value',
                    read: true,
                    write: true,
                    desc: 'Maximum allowed Value'
                },
                native: {val : 100,ack : true}
            });
            adapter.setState(item.techname+'.'+el, {val : 100,ack : true});
        }

        if (el=="increment") {
            await adapter.setObjectNotExistsAsync(item.techname+'.'+el, {
                type: 'state',
                common: {
                    name: 'Increment per Cycle',
                    type: 'number',
                    role: 'value',
                    read: true,
                    write: true,
                    desc: 'The increment per Cycle, positive and negative values possible'
                },
                native: {}
            });
            adapter.setState(item.techname+'.'+el, {val : 1,ack : true});
        }

        if (el=="reset") {
            await adapter.setObjectNotExistsAsync(item.techname+'.'+el, {
                type: 'state',
                common: {
                    name: 'Reset Sawtooth',
                    type: 'boolean',
                    role: 'button.reset',
                    read: true,
                    write: true,
                    desc: 'Reset sawtooth value to default'
                },
                native: {}
            });
            adapter.setState(item.techname+'.'+el, {val : false,ack : true});
        }

        if (el=="resetMode") {
            await adapter.setObjectNotExistsAsync(item.techname+'.'+el, {
                type: 'state',
                common: {
                    name: 'Reset mode',
                    type: 'number',
                    role: 'indicator.status',
                    read: true,
                    write: true,
                    desc: 'How to set value if resetted',
                    states: {0: 'SetToMin', 1: 'SetToMax'}
                },
                native: {}
            });
            adapter.setState(item.techname+'.'+el, {val : 0,ack : true});
        }

        if (el=="lastValue") {
            await adapter.setObjectNotExistsAsync(item.techname+'.'+el, {
                type: 'state',
                common: {
                    name: 'last saved Value',
                    type: 'number',
                    role: 'value',
                    read: true,
                    write: false,
                    desc: 'Last saved value for internal processing'
                },
                native: {}
            });
            adapter.setState(item.techname+'.'+el, {val : 0,ack : true});
        }

        if (el=="readOnly") {
            await adapter.setObjectNotExistsAsync(item.techname+'.'+el, {
                type: 'state',
                common: {
                    name: 'Readonly Value',
                    type: 'boolean',
                    role: 'switch',
                    read: true,
                    write: true,
                    desc: 'The currentValue could only be changed by adapter itself'
                },
                native: {}
            });
            adapter.setState(item.techname+'.'+el, {val : false,ack : true});
        }
}

function readNextState(item,states,idx) {
    if (idx>=states.length) {
        // all values read, lets process
        adapter.log.info(" all states read");
	var params={};
	for (var i = 0;i < states.length; i++) {
		params[states[i].name] = states[i].val;
	}

	// check readonly
	if (params.readOnly) params.currentValue=params.lastValue;

	// check reset
	if (params.reset) {
		adapter.log.info(" >> reset");
		// read reset-mode
		if (params.resetMode == 0) params.currentValue=params.minValue; else params.currentValue=params.maxValue;
		// temporary set some parameters, so that reset-value wont stay for that cycle
		params.lastValue=params.currentValue;
		params.increment=0;
		adapter.setState(item.techname+'.reset', { val : false, ack:true});
	} 
	
	// check if curValue was changed
	if (params.currentValue!=params.lastValue) {
		adapter.log.info(" >> value changed!");
		if (params.currentValue<params.lastValue && params.increment<0) params.currentValue=params.minValue; else params.currentValue=params.maxValue;
		// temporary set some parameters, so that the value wont be adjusted
		params.lastValue=params.currentValue;
		params.increment=0;
	}

	// do the increment
	params.currentValue+=params.increment;

	// check boundaries
	if (params.currentValue>params.maxValue) params.currentValue=params.maxValue;
	if (params.currentValue<params.minValue) params.currentValue=params.minValue;

	// store currentValue also as lastValue
	adapter.setState(item.techname+'.currentValue', { val : params.currentValue, ack:true});
        adapter.setState(item.techname+'.lastValue', { val : params.currentValue, ack:true});
	adapter.log.info(" >> new value: "+params.currentValue);
	
        return;
    }
    var stateName=states[idx].name;
    var path=item.techname+"."+stateName;
	adapter.getState(path, function (err, state) {
		if (state!=null) {
		    states[idx].val = state.val;
		    adapter.log.info(" > "+states[idx].name+" = "+states[idx].val);
		    readNextState(item,states,idx+1);
		} else {
		    adapter.log.info(" >! "+path);
		    createSawtooth(item,states[idx].name);
		    readNextState(item,states,idx);
        }
	});
}


// must be called first to initialize all parameters
// curStep is typically set to 0    
function globalInit(curStep) {
	var methodName = "globalInit";
	adapter.log.debug("in:  " + methodName + " v0.02");

	// All states changes inside the adapter's namespace are subscribed
	adapter.subscribeStates('*');

	var zoe_username = adapter.config.username;
	var zoe_password = adapter.config.password;
	var zoe_locale   = adapter.config.locale;
	var zoe_vin      = adapter.config.vin;
        var ignoreApiError = adapter.config.ignoreApiError;
        var kamereonapikey = adapter.config.kamereonApiKey;

	var localeParts=zoe_locale.split("_");
	var country="FR";
	if (localeParts.length>=2) country=localeParts[1];


	adapter.log.info("Username:"+zoe_username);
	//adapter.log.info("Password:"+zoe_password);
	adapter.log.info("Locale:"  +zoe_locale  );
	adapter.log.info("VIN:"     +zoe_vin     );
	adapter.log.info("Country:" +country     );
	adapter.log.info("ignoreApiError:"+(ignoreApiError?'true':'false'));
	
	var requestClient = axios.create();
        var defaultTimeout = adapter.config.timeout;

	var params={
		url:"https://renault-wrd-prod-1-euw1-myrapp-one.s3-eu-west-1.amazonaws.com/configuration/android/config_"+zoe_locale+".json",
		method:"get",
		timeout: defaultTimeout,
		validateStatus: function (status) {
			return true;
		}		
	};
	adapter.log.info("URL: "+params.url);

	requestClient(params).catch(function (error) {
			adapter.log.error('No valid response1 from Renault server');
			adapter.log.error(safeJSONParse(error));
			return processingFailed({}, 0, ZOEERROR_UNCORRECT_RESPONSE);
		}).then(function (response) {
		var statusCode = response.status;
		var body = response.data;
		var gigyarooturl = null;
		var gigyaapikey  = null;
		var kamereonrooturl = null;

	  	if (statusCode != 200) {
  			adapter.log.error('No valid response2 from Renault server, using default values');
			
			// Working default values
			gigyarooturl = 'https://accounts.eu1.gigya.com';
			gigyaapikey  = '3_7PLksOyBRkHv126x5WhHb-5pqC1qFR8pQjxSeLB6nhAnPERTUlwnYoznHSxwX668';
			kamereonrooturl = 'https://api-wired-prod-1-euw1.wrd-aws.com';
			
			// return processingFailed({}, 0, ZOEERROR_UNCORRECT_RESPONSE);
  		} else {
			adapter.log.debug('Data received from Renault server');
			var data = safeJSONParse(body);
			if (data===false) return processingFailed({}, 0, ZOEERROR_UNPARSABLE_JSON);

			gigyarooturl = data.servers.gigyaProd.target;
			gigyaapikey  = data.servers.gigyaProd.apikey;
			kamereonrooturl = data.servers.wiredProd.target;
			// var kamereonapikey  = data.servers.wiredProd.apikey;
		}

		adapter.log.info("gigyarooturl:"+gigyarooturl);
		adapter.log.info("gigyaapikey:"+gigyaapikey);
		adapter.log.info("kamereonrooturl:"+kamereonrooturl);
		adapter.log.info("kamereonapikey:"+kamereonapikey);

		var globalParams = {
			zoe_username:zoe_username,
			zoe_password:zoe_password,
			zoe_locale:zoe_locale,
			zoe_vin:zoe_vin,
			gigyarooturl:gigyarooturl,
			gigyaapikey:gigyaapikey,
			kamereonrooturl:kamereonrooturl,
			kamereonapikey:kamereonapikey,
			country:country,
			ignoreApiError:ignoreApiError,
			useLocationApi:adapter.config.useLocationApi,
			useHVACApi:adapter.config.useHVACApi,
			stopChargeWorkaroundHour:adapter.config.stopChargeWorkaroundHour,
			requestClient:requestClient,
			defaultTimeout:defaultTimeout
		};

		// create root config element
		adapter.setObjectNotExists(zoe_vin, {
			type : 'device',
			common : {
				name : zoe_vin,
				type : 'string',
				role : 'sensor',
				ack : true
			},
			native : {}
		});

		processNextStep(globalParams, curStep);
	});

	adapter.log.debug("out: " + methodName);
}

// called on success, start next step
function processNextStep(globalParams, curStep) {
	adapter.log.debug("in: processNextStep, curStep: "+ curStep);
    var nextStep = curStep + 1;

    // only one shot if curStep = -1 (for debugging or testing)
    if (curStep==-1) return;
    
    switch(nextStep) {
        case  1: return globalInit           (nextStep);
        case  2: return loginToGigya         (globalParams, nextStep);
        case  3: return gigyaGetJWT          (globalParams, nextStep);
        case  4: return gigyaGetAccount      (globalParams, nextStep);
        case  5: return getKamereonAccount   (globalParams, nextStep);																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																					
        case  6: return getKamereonCars      (globalParams, nextStep);
        case  7: return getBatteryStatus     (globalParams, nextStep);
        case  8: return getCockpit           (globalParams, nextStep);
        case  9: return getLocation          (globalParams, nextStep);
        case 10: return getHVACStatus        (globalParams, nextStep);
        case 11: return initCheckPreconAndCharge (globalParams, nextStep);
        case 12: return checkPreconNow       (globalParams, nextStep);
        case 13: return checkChargeCancel    (globalParams, nextStep);
        case 14: return checkChargeEnable    (globalParams, nextStep);
        
        case 15: return processingFinished   (globalParams, nextStep);

        default: return processingFailed(globalParams, curStep, ZOEERROR_NONEXTSTEP);
    }
}

// called on error, exiting with error code
function processingFailed(globalParams, curStep, errorCode) {
    // check if failing in step is ok
    if (errorCode==ZOEERROR_UNCORRECT_RESPONSE && globalParams.ignoreApiError) {
        switch(curStep) {
            case  7: return processNextStep(globalParams, curStep);
            case  8: return processNextStep(globalParams, curStep);
            case  9: return processNextStep(globalParams, curStep);
            case 10: return processNextStep(globalParams, curStep);
            default: break;
        }
    }
	adapter.log.debug("in: processingFailed, curStep: "+ curStep);
    adapter.log.error('Error in step '+curStep+', errorCode: '+errorCode);
    adapter.terminate ? adapter.terminate(1) :process.exit(1);
}

// finished processing successfull
function processingFinished(globalParams, curStep) {
    adapter.terminate ? adapter.terminate() :process.exit(0);
}


function loginToGigya(globalParams, curStep) {
	var methodName = "loginToGigya";
	adapter.log.debug("in:  " + methodName + " v0.02");

	//var payload = {loginID: globalParams.zoe_username, password: globalParams.zoe_password, ApiKey: globalParams.gigyaapikey};
	var params={
		url:globalParams.gigyarooturl + 
			'/accounts.login?apiKey=' + encodeURIComponent(globalParams.gigyaapikey) + 
			'&loginID=' + encodeURIComponent(globalParams.zoe_username) + 
			'&password=' + encodeURIComponent(globalParams.zoe_password) + 
			'&include=data',
		method:"get",
		timeout: globalParams.defaultTimeout
	};

	globalParams.requestClient(params).catch(function (error) {
  			adapter.log.error('No valid response2 from gigyarooturl server');
			adapter.log.error(safeJSONParse(error));
  			return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
		}).then(function (response) {
		var statusCode = response.status;
		var body = response.data;
	  	if (statusCode != 200) {
  			adapter.log.error('No valid response2 from gigyarooturl server');
  			return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
  		} else {
			adapter.log.debug('Data received from gigyarooturl server');
			var data = safeJSONParse(body);
			if (data===false) return processingFailed(globalParams, 0, ZOEERROR_UNPARSABLE_JSON);
			adapter.log.info("FullBody:"+JSON.stringify(data));

			var sessionInfo=data.sessionInfo;
			adapter.log.info("sessionInfo:"+JSON.stringify(sessionInfo));
			
			if (typeof sessionInfo === 'undefined') {
				adapter.log.error('Not receiving sessionInfo from gigya server, please make sure username/password is correct');
				return;
			}
			
			globalParams.gigyatoken=sessionInfo.cookieValue;
			processNextStep(globalParams, curStep);
		}
	});
}

function gigyaGetJWT(globalParams, curStep) {
	var methodName = "gigyaGetJWT";
	adapter.log.debug("in:  " + methodName + " v0.02");

	var params={
		url:globalParams.gigyarooturl + 
			'/accounts.getJWT?login_token=' + encodeURIComponent(globalParams.gigyatoken) + 
			'&ApiKey=' + encodeURIComponent(globalParams.gigyaapikey) +
			'&fields=' + encodeURIComponent('data.personId,data.gigyaDataCenter') + 
			'&expiration=' + encodeURIComponent('900'),
		method:"get",
		timeout: globalParams.defaultTimeout
	};

	globalParams.requestClient(params).catch(function (error) {
  			adapter.log.error('No valid response1 from gigyaGetJWT service');
			adapter.log.error(safeJSONParse(error));
  			return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
		}).then(function (response) {
		var statusCode = response.status;
		var body = response.data;
	  	if (statusCode != 200) {
  			adapter.log.error('No valid response2 from gigyaGetJWT service');
  			return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
  		} else {
			adapter.log.debug('Data received from gigyaGetJWT service');
			var data = safeJSONParse(body);
			if (data===false) return processingFailed(globalParams, 0, ZOEERROR_UNPARSABLE_JSON);
			adapter.log.info("getJWTFullbody:"+JSON.stringify(data));
			globalParams.gigya_jwttoken=data.id_token;
			adapter.log.info("gigya_jwttoken:"+globalParams.gigya_jwttoken);
			processNextStep(globalParams, curStep);
		}
	});
	adapter.log.debug("out: " + methodName);
}

function gigyaGetAccount(globalParams, curStep) {
	var methodName = "gigyaGetAccount";
	adapter.log.debug("in:  " + methodName + " v0.02");

	var params={
		url:globalParams.gigyarooturl + 
			'/accounts.getAccountInfo?login_token=' + encodeURIComponent(globalParams.gigyatoken) + 
			'&ApiKey=' + encodeURIComponent(globalParams.gigyaapikey),
		method:"get",
		timeout: globalParams.defaultTimeout
	};

	globalParams.requestClient(params).catch(function (error) {
  			adapter.log.error('No valid response1 from gigyagetAccountInfo service');
			adapter.log.error(safeJSONParse(error));
  			return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
		}).then(function (response) {
		var statusCode = response.status;
		var body = response.data;
	  	if (statusCode != 200) {
  			adapter.log.error('No valid response2 from gigyagetAccountInfo service');
  			return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
  		} else {
			adapter.log.debug('Data received from gigyagetAccountInfo service');
			var data = safeJSONParse(body);
			if (data===false) return processingFailed(globalParams, 0, ZOEERROR_UNPARSABLE_JSON);
			adapter.log.info("getgetAccountInfo:"+JSON.stringify(data));
			globalParams.kamereonpersonid=data.data.personId;
			adapter.log.info("kamereonpersonid:"+globalParams.kamereonpersonid);
			processNextStep(globalParams, curStep);
		}
	});
	adapter.log.debug("out: " + methodName);
}

function getKamereonAccount(globalParams, curStep) {
	var methodName = "getKamereonAccount";
	adapter.log.debug("in:  " + methodName + " v0.02");

	var params={
		url:globalParams.kamereonrooturl + 
			'/commerce/v1/persons/' + globalParams.kamereonpersonid+
			'?country='+ encodeURIComponent(globalParams.country),
		method:"get",
		headers: {
    			'x-gigya-id_token': globalParams.gigya_jwttoken,
    			'apikey': globalParams.kamereonapikey
		},
		timeout: globalParams.defaultTimeout
	};

	globalParams.requestClient(params).catch(function (error) {
  			adapter.log.error('No valid response1 from getKamereonAccount service');
			adapter.log.error('Maybe Kamereon-API Key has changed, please check https://github.com/fungus75/ioBroker.zoe2/wiki');
			adapter.log.error(safeJSONParse(error));
  			return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
		}).then(function (response) {
		var statusCode = response.status;
		var body = response.data;
	  	if (statusCode != 200) {
  			adapter.log.error('No valid response2 from getKamereonAccount service');
  			return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
  		} else {
			adapter.log.debug('Data received from getKamereonAccount service');
			var data = safeJSONParse(body);
			if (data===false) return processingFailed(globalParams, 0, ZOEERROR_UNPARSABLE_JSON);
			adapter.log.info("getKamereonAccount:"+JSON.stringify(data));
			var accounts=data.accounts;
			adapter.log.info("accounts:"+JSON.stringify(accounts));
			globalParams.kamereonaccountid=accounts[0].accountId;
			adapter.log.info("kamereonaccountid:"+globalParams.kamereonaccountid);
			processNextStep(globalParams, curStep);
		}
	});
	adapter.log.debug("out: " + methodName);
}

function getKamereonCars(globalParams, curStep) {
	var methodName = "getKamereonCars";
	adapter.log.debug("in:  " + methodName + " v0.02");

	var params={
		url:globalParams.kamereonrooturl + 
			'/commerce/v1/accounts/' + globalParams.kamereonaccountid+'/vehicles'+
			'?country='+ encodeURIComponent(globalParams.country),
		method:"get",
		headers: {
    			'x-gigya-id_token': globalParams.gigya_jwttoken,
    			'apikey': globalParams.kamereonapikey,
		},
		timeout: globalParams.defaultTimeout
	};

	globalParams.requestClient(params).catch(function (error) {
  			adapter.log.error('No valid response1 from getKamereonCars service');
			adapter.log.error(safeJSONParse(error));
  			return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
		}).then(function (response) {
		var statusCode = response.status;
		var body = response.data;
	  	if (statusCode != 200) {
  			adapter.log.error('No valid response2 from getKamereonCars service');
  			return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
  		} else {
			adapter.log.debug('Data received from getKamereonCars service');
			var data = safeJSONParse(body);
			if (data===false) return processingFailed(globalParams, 0, ZOEERROR_UNPARSABLE_JSON);
			adapter.log.info("getKamereonCars:"+JSON.stringify(data));
			processNextStep(globalParams, curStep);
		}
	});
	adapter.log.debug("out: " + methodName);
}

function getBatteryStatus(globalParams, curStep) {
	var methodName = "getBatteryStatus";
	adapter.log.debug("in:  " + methodName + " v0.02");

	var params={
		url:globalParams.kamereonrooturl + 
			'/commerce/v1/accounts/'+ globalParams.kamereonaccountid+
			'/kamereon/kca/car-adapter/v2/cars/' + globalParams.zoe_vin + '/battery-status'+
			'?country='+ encodeURIComponent(globalParams.country),
		method:"get",
		headers: {
    			'x-gigya-id_token': globalParams.gigya_jwttoken,
    			'apikey': globalParams.kamereonapikey,
			'Content-Type':'application/vnd.api+json'
		},
		timeout: globalParams.defaultTimeout
	};
	adapter.log.info("getBatteryStatus-url:"+params.url);

	globalParams.requestClient(params).catch(function (error) {
  			adapter.log.error('No valid response1 from getBatteryStatus service');
			adapter.log.error(safeJSONParse(error));
  			return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
		}).then(function (response) {
		var statusCode = response.status;
		var body = response.data;
	  	if (statusCode != 200) {
  			adapter.log.error('No valid response2 from getBatteryStatus service');
			adapter.log.info('response:'+JSON.stringify(response));
            return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
  		} else {
			adapter.log.debug('Data received from getBatteryStatus service');
			var data = safeJSONParse(body);
			if (data===false) return processingFailed(globalParams, 0, ZOEERROR_UNPARSABLE_JSON);
			adapter.log.info("getBatteryStatus:"+JSON.stringify(data));
			var attributes=data;

			var charge_level   =attributes.batteryLevel;
			var plugged        =attributes.plugStatus==1;
			var charging       =attributes.chargingStatus==1;
			var remaining_range=attributes.batteryAutonomy;
			var remaining_time =attributes.chargingRemainingTime;
			var batteryTemperature=attributes.batteryTemperature;
			var chargingPower  =attributes.chargingInstantaneousPower;
			var batteryCapacity=attributes.batteryCapacity;
			var batteryAvailableEnergy=attributes.batteryAvailableEnergy;

			var batteryTS=attributes.timestamp;
			if (batteryTS) {
			    var bts=new Date(batteryTS);
				setValue(globalParams.zoe_vin,"batteryTS","string",bts.toString(),"date");
			} else {
				setValue(globalParams.zoe_vin,"batteryTS","string",null,"date");
			}
			

			if (!charging) {
				chargingPower = 0;
				remaining_time = 0;
			}
				

			if (remaining_time === undefined || remaining_time === null) remaining_time = 0;
			var chargingFinishedAt=new Date(Date.now() + remaining_time * 60000);
			if (remaining_time == 0) chargingFinishedAt=null;
			var cfa='9999-12-31';
			if (remaining_time > 0) cfa=chargingFinishedAt.toString(); 
			adapter.log.info('remaining_time:'+remaining_time);
			adapter.log.info('cfa:'+cfa);

			if (!charging) chargingPower = 0;

            setValue(globalParams.zoe_vin,"charge_level","number",charge_level,"data");
            setValue(globalParams.zoe_vin,"remaining_range","number",remaining_range,"data");
            setValue(globalParams.zoe_vin,"remaining_time","number",remaining_time),"data";
            setValue(globalParams.zoe_vin,"charging_finished_at","string",cfa,"date");
            setValue(globalParams.zoe_vin,"plugged","boolean",plugged,"data");
            setValue(globalParams.zoe_vin,"charging","boolean",charging,"data");
            setValue(globalParams.zoe_vin,"batteryTemperature","number",batteryTemperature,"data");
            setValue(globalParams.zoe_vin,"chargingPower","number",chargingPower,"data");
            setValue(globalParams.zoe_vin,"batteryCapacity","number",batteryCapacity,"data");
            setValue(globalParams.zoe_vin,"batteryAvailableEnergy","number",batteryAvailableEnergy,"data");
			processNextStep(globalParams, curStep);
		}
	});
}

function getCockpit(globalParams, curStep) {
	var methodName = "getCockpit";
	adapter.log.debug("in:  " + methodName + " v0.02");

	var params={
		url:globalParams.kamereonrooturl + 
			'/commerce/v1/accounts/'+ globalParams.kamereonaccountid+
			'/kamereon/kca/car-adapter/v2/cars/' + globalParams.zoe_vin + '/cockpit'+
			'?country='+ encodeURIComponent(globalParams.country),
		method:"get",
		headers: {
    			'x-gigya-id_token': globalParams.gigya_jwttoken,
    			'apikey': globalParams.kamereonapikey,
			'Content-Type':'application/vnd.api+json'
		},
		timeout: globalParams.defaultTimeout
	};
	adapter.log.info("getCockpit-url:"+params.url);

	globalParams.requestClient(params).catch(function (error) {
  			adapter.log.error('No valid response1 from getCockpit service');
			adapter.log.error(safeJSONParse(error));
  			return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
		}).then(function (response) {
		var statusCode = response.status;
		var body = response.data;
	  	if (statusCode != 200) {
  			adapter.log.error('No valid response from getCockpit service');
			adapter.log.info('response:'+JSON.stringify(response));
            return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
  		} else {
			adapter.log.debug('Data received from getCockpit service');
			var data = safeJSONParse(body);
			if (data===false) return processingFailed(globalParams, 0, ZOEERROR_UNPARSABLE_JSON);
			adapter.log.info("getCockpit:"+JSON.stringify(data));

			var totalMileage=data.totalMileage;
			if (totalMileage !== undefined) setValue(globalParams.zoe_vin,"totalMileage","number",totalMileage,"data");
			processNextStep(globalParams, curStep);
		}
	});
	adapter.log.debug("out: " + methodName);
}

function getLocation(globalParams, curStep) {
	var methodName = "getLocation";
	adapter.log.debug("in:  " + methodName + " v0.02");
	if (!globalParams.useLocationApi) {
		adapter.log.info(methodName+" not enabled in config");
		return processNextStep(globalParams, curStep);
	}

	var params={
		url:globalParams.kamereonrooturl + 
			'/commerce/v1/accounts/'+ globalParams.kamereonaccountid+
			'/kamereon/kca/car-adapter/v1/cars/' + globalParams.zoe_vin + '/location'+
			'?country='+ encodeURIComponent(globalParams.country),
		method:"get",
		headers: {
    			'x-gigya-id_token': globalParams.gigya_jwttoken,
    			'apikey': globalParams.kamereonapikey,
			'Content-Type':'application/vnd.api+json'
		},
		timeout: globalParams.defaultTimeout
	};
	adapter.log.info("getLocation-url:"+params.url);

	globalParams.requestClient(params).catch(function (error) {
  			adapter.log.error('No valid response1 from getLocation service');
			adapter.log.error(safeJSONParse(error));
  			return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
		}).then(function (response) {
		var statusCode = response.status;
		var body = response.data;
	  	if (statusCode != 200) {
  			adapter.log.error('No valid response2 from getLocation service');
			adapter.log.info('response:'+JSON.stringify(response));
            return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
  		} else {
			adapter.log.debug('Data received from getLocation service');
			var data = safeJSONParse(body);
			if (data===false) return processingFailed(globalParams, 0, ZOEERROR_UNPARSABLE_JSON);
			adapter.log.info("getLocation:"+JSON.stringify(data));
			
			var gpsLatitude=data.gpsLatitude;
			adapter.log.info('gpsLatitude:'+gpsLatitude);
			if (gpsLatitude !== undefined) setValue(globalParams.zoe_vin,"gpsLatitude","number",gpsLatitude,"data");

			var gpsLongitude=data.gpsLongitude;
			adapter.log.info('gpsLongitude:'+gpsLongitude);
			if (gpsLongitude !== undefined) setValue(globalParams.zoe_vin,"gpsLongitude","number",gpsLongitude,"data");
			processNextStep(globalParams, curStep);
		}
	});
}


function getHVACStatus(globalParams, curStep) {
	var methodName = "getHVACStatus";
	adapter.log.debug("in:  " + methodName + " v0.02");

	if (!globalParams.useHVACApi) {
		adapter.log.info(methodName+" not enabled in config");
		return processNextStep(globalParams, curStep);
	}

	var params={
		url:globalParams.kamereonrooturl + 
			'/commerce/v1/accounts/'+ globalParams.kamereonaccountid+
			'/kamereon/kca/car-adapter/v1/cars/' + globalParams.zoe_vin + '/hvac-status'+
			'?country='+ encodeURIComponent(globalParams.country),
		method:"get",
		headers: {
    			'x-gigya-id_token': globalParams.gigya_jwttoken,
    			'apikey': globalParams.kamereonapikey,
			'Content-Type':'application/vnd.api+json'
		},
		timeout: globalParams.defaultTimeout
	};
	adapter.log.info("getHVACStatus-url:"+params.url);

	globalParams.requestClient(params).catch(function (error) {
  			adapter.log.error('No valid response1 from getHVACStatus service');
			adapter.log.error(safeJSONParse(error));
  			return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
		}).then(function (response) {
		var statusCode = response.status;
		var body = response.data;
	  	if (statusCode != 200) {
  			adapter.log.error('No valid response2 from getHVACStatus service');
			adapter.log.info('response:'+JSON.stringify(response));
			return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
  		} else {
			adapter.log.debug('Data received from getHVACStatus service');
			var data = safeJSONParse(body);
			if (data===false) return processingFailed(globalParams, 0, ZOEERROR_UNPARSABLE_JSON);
			adapter.log.info("getHVACStatus:"+JSON.stringify(data));

			var attributes=data;
			var hvacOn=attributes.hvacStatus!="off";

			setValue(globalParams.zoe_vin,"externalTemperature","number",attributes.externalTemperature,"data");
                        setValue(globalParams.zoe_vin,"hvacOn","boolean",hvacOn,"data");
			processNextStep(globalParams, curStep);
		}
	});
	adapter.log.debug("out: " + methodName);
}

function initCheckPreconAndCharge(globalParams, curStep) {
	var methodName = "initCheckPreconAndCharge";
	adapter.log.debug("in:  " + methodName + " v0.01");

	adapter.setObjectNotExists(globalParams.zoe_vin+".preconNow", {
		type : 'state',
		common: {
			name : 'preconNow',
			type : 'boolean',
			role : 'button',
			ack : true
		},
		native : {}
	});
    adapter.setObjectNotExists(globalParams.zoe_vin+".chargeCancel", {
            type : 'state',
            common: {
                    name : 'chargeCancel',
                    type : 'boolean',
                    role : 'button',
                    ack : true
            },
            native : {}
    });
    adapter.setObjectNotExists(globalParams.zoe_vin+".chargeEnable", {
            type : 'state',
            common: {
                    name : 'chargeEnable',
                    type : 'boolean',
                    role : 'button',
                    ack : true
            },
            native : {}
    });
    processNextStep(globalParams, curStep);
}

function checkPreconNow(globalParams, curStep) {
	var methodName = "checkPreconNow";
	adapter.log.debug("in:  " + methodName + " v0.01");
	adapter.getState(globalParams.zoe_vin+".preconNow", function (err, state) {
		if (state!=null && state.val) {
			adapter.log.info("preconNow pressed!!!");
			adapter.setState(globalParams.zoe_vin+".preconNow",false,true); // set back to false
			startStopPrecon(globalParams,true,21, curStep);
		    processNextStep(globalParams, curStep);
		} else {
		    processNextStep(globalParams, curStep);
        }
	});
}

function checkChargeCancel(globalParams, curStep) {
	var methodName = "checkChargeCancel";
	adapter.log.debug("in:  " + methodName + " v0.01");
	adapter.getState(globalParams.zoe_vin+".chargeCancel", function (err, state) {
        if (state!=null && state.val) {
            adapter.log.info("chargeCancel pressed!!!");
            chargeStartOrCancel(globalParams,false,resetChargeButtons, curStep);
		    processNextStep(globalParams, curStep);
		} else {
		    processNextStep(globalParams, curStep);
        }
    });
}

function checkChargeEnable(globalParams, curStep) {
	var methodName = "checkChargeEnable";
	adapter.log.debug("in:  " + methodName + " v0.01");
    adapter.getState(globalParams.zoe_vin+".chargeEnable", function (err, state) {
        if (state!=null && state.val) {
            adapter.log.info("chargeEnable pressed!!!");
            chargeStartOrCancel(globalParams,true,resetChargeButtons, curStep);
		    processNextStep(globalParams, curStep);
		} else {
		    processNextStep(globalParams, curStep);
        }
    });
}

function resetChargeButtons(globalParams) {
	adapter.setState(globalParams.zoe_vin+".chargeEnable",false,true);
	adapter.setState(globalParams.zoe_vin+".chargeCancel",false,true); 
}


function startStopPrecon(globalParams,startIt,temperature,curStep) {
	var methodName = "startStopPrecon";
	adapter.log.debug("in:  " + methodName + " v0.02");

	var params={
		url:globalParams.kamereonrooturl + 
			'/commerce/v1/accounts/'+ globalParams.kamereonaccountid+
			'/kamereon/kca/car-adapter/v1/cars/' + globalParams.zoe_vin + '/actions/hvac-start'+
			'?country='+ encodeURIComponent(globalParams.country),
		method:"post",
		headers: {
    			'x-gigya-id_token': globalParams.gigya_jwttoken,
    			'apikey': globalParams.kamereonapikey,
			    'Content-Type':'application/vnd.api+json'
		},
		data: {
			data: {
				'type': 'HvacStart',
                		'attributes': {
					'action': startIt?'start':'stop',
					'targetTemperature': temperature
				}
			}
		},
		timeout: globalParams.defaultTimeout
	};
	adapter.log.info("startStopPrecon-url:"+params.url);

	globalParams.requestClient(params).catch(function (error) {
  			adapter.log.error('No valid response1 from startStopPrecon service');
			adapter.log.error(safeJSONParse(error));
  			return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
		}).then(function (response) {
		var statusCode = response.status;
		var body = response.data;
	  	if (statusCode != 200) {
  			adapter.log.error('No valid response2 from startStopPrecon service');
			adapter.log.info('response:'+JSON.stringify(response));
  			return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
  		} else {
			adapter.log.debug('Data received from startStopPrecon service');
			var data = safeJSONParse(body);
			if (data===false) return processingFailed(globalParams, 0, ZOEERROR_UNPARSABLE_JSON);
			adapter.log.info("startStopPrecon:"+JSON.stringify(data));
		}
	});
}

function chargeStartOrCancel(globalParams,startIt,onSuccess, curStep) {
	var methodName = "chargeStartOrCancel";
	adapter.log.debug("in:  " + methodName + " v0.01");

	var params={
		url:globalParams.kamereonrooturl + 
			'/commerce/v1/accounts/'+ globalParams.kamereonaccountid+
			'/kamereon/kca/car-adapter/v1/cars/' + globalParams.zoe_vin + '/actions/charge-mode'+
			'?country='+ encodeURIComponent(globalParams.country),
		method:"post",
		headers: {
    			'x-gigya-id_token': globalParams.gigya_jwttoken,
    			'apikey': globalParams.kamereonapikey,
			'Content-Type':'application/vnd.api+json'
		},
		data: {
			data: {
				'type': 'ChargeMode',
                		'attributes': {
					'action': startIt?'always_charging':'schedule_mode'
				}
			}
		},
		timeout: globalParams.defaultTimeout
	};
	adapter.log.info("chargeStartOrCancel-url:"+params.url);

	globalParams.requestClient(params).catch(function (error) {
  			adapter.log.error('No valid response1 from chargeStartOrCancel service');
			adapter.log.error(safeJSONParse(error));
  			return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
		}).then(function (response) {
		var statusCode = response.status;
		var body = response.data;
	  	if (statusCode != 200) {
  			adapter.log.error('No valid response2 from chargeStartOrCancel service');
			adapter.log.info('response:'+JSON.stringify(response));
  			return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
  		} else {
			adapter.log.debug('Data received from chargeStartOrCancel service');
			var data = safeJSONParse(body);
			if (data===false) return processingFailed(globalParams, 0, ZOEERROR_UNPARSABLE_JSON);
			adapter.log.info("chargeStartOrCancel:"+JSON.stringify(data));

			if (startIt) {
				// trigger charge-start
				params.url=globalParams.kamereonrooturl + 
				'/commerce/v1/accounts/'+ globalParams.kamereonaccountid+
				'/kamereon/kca/car-adapter/v1/cars/' + globalParams.zoe_vin + '/actions/charging-start'+
				'?country='+ encodeURIComponent(globalParams.country);
				
				params.data={
					data: {
						'type': 'ChargingStart',
                				'attributes': {
                    					'action': 'start'
                				}
					}		
				};
				
				globalParams.requestClient(params).catch(function (error) {
					adapter.log.error('No valid response1 from chargeStartOrCancel2 service');
					adapter.log.error(safeJSONParse(error));
					return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
				}).then(function (response) {
					var statusCode = response.status;
					var body = response.data;
					if (statusCode != 200) {
	  					adapter.log.error('No valid response2 from chargeStartOrCancel2 service');
						adapter.log.info('response:'+JSON.stringify(response));
              			return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
	  				} else {
						adapter.log.debug('Data received from chargeStartOrCancel2 service');
			            var data = safeJSONParse(body);
			            if (data===false) return processingFailed(globalParams, 0, ZOEERROR_UNPARSABLE_JSON);
						adapter.log.info("chargeStartOrCancel2:"+JSON.stringify(data));
						onSuccess(globalParams);
					}
				});
				
			} else {
				// Set start time to configured parameter
				params.url=globalParams.kamereonrooturl + 
				'/commerce/v1/accounts/'+ globalParams.kamereonaccountid+
				'/kamereon/kca/car-adapter/v2/cars/' + globalParams.zoe_vin + '/actions/charge-schedule'+
				'?country='+ encodeURIComponent(globalParams.country);
				
				var startTimeString='T';
				if (globalParams.stopChargeWorkaroundHour<10) startTimeString+='0';
				startTimeString+=globalParams.stopChargeWorkaroundHour+':00Z';
				adapter.log.info('startTimeString:'+startTimeString);
				
				params.data={
					data: {
						'type': 'ChargeSchedule',
                				'attributes': {
							'schedules': [{'id':1,'activated':true,
								'monday':{'startTime':startTimeString,'duration':15},
								'tuesday':{'startTime':startTimeString,'duration':15},
								'wednesday':{'startTime':startTimeString,'duration':15},
								'thursday':{'startTime':startTimeString,'duration':15},
								'friday':{'startTime':startTimeString,'duration':15},
								'saturday':{'startTime':startTimeString,'duration':15},
								'sunday':{'startTime':startTimeString,'duration':15}
								}]
						}
					}		
				};
				
				globalParams.requestClient(params).catch(function (error) {
					adapter.log.error('No valid response1 from chargeStartOrCancel2 service');
					adapter.log.error(safeJSONParse(error));
					return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
				}).then(function (response) {
					var statusCode = response.status;
					var body = response.data;
					if (statusCode != 200) {
	  					adapter.log.error('No valid response2 from chargeStartOrCancel2 service');
						adapter.log.info('response:'+JSON.stringify(response));
              			return processingFailed(globalParams, curStep, ZOEERROR_UNCORRECT_RESPONSE);
	  				} else {
						adapter.log.debug('Data received from chargeStartOrCancel2 service');
			            var data = safeJSONParse(body);
			            if (data===false) return processingFailed(globalParams, 0, ZOEERROR_UNPARSABLE_JSON);
						adapter.log.info("chargeStartOrCancel2:"+JSON.stringify(data));
						onSuccess(globalParams);
					}
				});
			} // if (!startIt)
		}
	});
}

function setValue(baseId,name,type,value,role) {
	var id=baseId+"."+name;
	adapter.setObjectNotExists(id, {
		type : 'state',
		common : {
			name : name,
			type : type,
			role : role,
			ack : true
		},
		native : {}
	});

	adapter.setState(id, {
		val : value,
		ack : true
	});
}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}
