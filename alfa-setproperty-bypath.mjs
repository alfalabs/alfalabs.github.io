/** alfa-setproperty-bypath   21.12.29  */

const LOG_PREF = '[alfa-setproperty-bypath]'

    /** setPropertyByPath  9.11.8   - 21.3.19
     *  @returns parent property from path 
     *      or null if error occurred
     *      or value at path if opts.get=true
     * 
     * @param {Object}  obj   - an object with properties, in prevoius version it is instance of alfa-autopage, which has dsApp property
     * @param {String}  path  
     * @param {*}       value 
     * @param {Function} errCallback(err) - optional
     * @param {Object}  opts {
     *                      get:true - return a value at path instead parent prop
     *                      delete:true
     *                  }
     */
    function setPropertyByPath(obj, path, value, errCallback, opts={}) {
        if(errCallback && typeof errCallback!=='function'){console.error(LOG_PREF, 'setPropertyByPath() errCallback is not a function!', {obj, path})}

        if(typeof path!=='string'){
            var err = {fn:'setPropertyByPath()', message: `path is not a string, value: '${value}' ${JSON.stringify(opts)}` }
            if(typeof errCallback==='function') errCallback(err);
            return null;
        }

        if(!path) {
            var err = {fn:'setPropertyByPath()', message: `path: '${path}', value: '${value}'` }
            if(typeof errCallback==='function') errCallback(err);
            return null;
        }

        //* when getPropertyByPath()
        if(opts.get){
            var retValue = true
            var prop = obj
            var parts = path.split('.')
            parts.forEach(function(part){
                if(typeof prop[part] !=='undefined'){
                    prop = prop[part]
                } else {
                    retValue = false
                }
            })
            // console.log(LOG_PREF, prop)
            if(retValue) return prop    // --- >
            else return undefined       // --- >
        }

        var prop = obj; //* find parent prop

        //* in case when needed to create new prop in the middle of chain
        var lastFoundProp = obj;
        var newPropName; 

        var propNames = path.split('.');
        for (var i = 0; i < propNames.length - 1; i++){
            
            if(prop===null){return null} /*   --- >
                special case when getPropertyByPath asks for property of null object, example:
                get(dsElem.editedRow._currentValue.Equipment) after dsElem.editedRow was set to null   */

            prop = prop[propNames[i]];

            if(typeof prop==='undefined' || typeof prop !=='object'){ //* 'undefined' - new prop, !'object' - existing literal value of the prop
                //* create new prop
                newPropName = propNames[i];
                lastFoundProp[newPropName] = {};
                lastFoundProp = lastFoundProp[newPropName];
                prop = lastFoundProp;
                // console.log(LOG_PREF, 'setPropertyByPath() create new prop',  obj, {lastFoundProp, i, newPropName})
            } else {
                lastFoundProp = prop 
            }
        }
        var propName = propNames[i];

        //* 22.1.5  opts.get handled above
        // if(opts.get){return prop===null ? null : prop[propName];} // ------------- >


        /** ***********************************************************************************************************
         *  error resulting from undefined or null can be ignored, since these are legitimate values to be stored in ds 
         * */
        var errObj

        if(typeof lastFoundProp==='undefined') {
            errObj = {fn:'setPropertyByPath()', message: 'lastFoundProp is undefined!', propName }; // `path: '${path}' not found!`
        }
        if(lastFoundProp===null) {
            errObj = {fn:'setPropertyByPath()', message: 'lastFoundProp is null!', propName }; // `path: '${path}' not found!`
        }
        try{

            if(opts.delete){
                delete lastFoundProp[propName]
            } else {

                lastFoundProp[propName] = value    // *** asigning value to a prop

            }
        } catch(err){
            errObj = {fn:'setPropertyByPath()', message: err.message}
        }

        if(errObj){
            /** ignore, enable for debugging */
            // if(typeof errCallback==='function') errCallback(errObj);
            
            return null; // --- >
        }

        return prop; // parent prop from path
    }

    function getPropertyByPath(obj, path, errCallback, opts={}){
        if(errCallback && typeof errCallback!=='function'){console.error(LOG_PREF, 'getPropertyByPath() errCallback is not a function!', {obj, path})}
        opts.get = true
        return setPropertyByPath(obj, path, null, errCallback, opts)
        // return setPropertyByPath(obj, path, null, errCallback, {get:true})
    }
    function delPropertyByPath(obj, path, errCallback, opts={}){
        if(errCallback && typeof errCallback!=='function'){console.error(LOG_PREF, 'delPropertyByPath() errCallback is not a function!', {obj, path})}
        opts.delete = true
        return setPropertyByPath(obj, path, null, errCallback, opts)
    }

export {setPropertyByPath, getPropertyByPath, delPropertyByPath};

