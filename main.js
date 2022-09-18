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


    // check increment (0 means "disabled")
    if (params.increment == 0) {
        adapter.log.info(" increment = 0 ==> sawtool disabled for "+item.techname);
        // just set lastValue and exit
        adapter.setState(item.techname+'.lastValue', { val : params.currentValue, ack:true});
        return;        
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

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}
