const LOG_PREF = '[alfa-databinding]'
const log = function(){console.log.apply(null, Array.from(arguments))} // function(){} //forDEBUG: 

import {setPropertyByPath, getPropertyByPath, delPropertyByPath} from '../alfa-setproperty-bypath.mjs'

/* supported_binding_paths = {

    'bound_path': {},
    'bound_path_out': {},


    'bound_path_out_label': {},  //* finds elem.closest('label')
    'bound_path_out_text': {},   //* <datalist> elem with text:value

    'bound_onchange': {},

    //* elem_action

    'bound_path_disabled': {},
    'bound_path_disabled_onfalse': {},
    'bound_path_hidden': {},
    'bound_path_select_item': {},     //* selecting by value in <SELECT><OPTION> 
    'bound_path_select_by_index': {},
    'bound_path_clear_selected': {}
*/

class AlfaDatabinding{

    /**
     * @param   DOM_object - DOM object to scan for html components with bound_paths @optional
     *                    @default = document object
     *                    or
     *                    this.shadowRoot
     *                      elements inside shadow DOM will not be found, 
     *                      that's why a separate instance has to be invoked inside web-component:
     *                      new AlfaDatabinding(this.shadowRoot, this) 
     * @param   ds_root - Data Source root, @optional
     *                    @default = window object, 
     *                      can be any object if not in multiScope mode, 
     *                      multiScope: it should be the web-component itself (multiScope is too complicated)
     * @param ds_rootType: @optional setting root_type turns on multiScope support for multipage apps
     *                      dsApp|dsPage|dsElem 
     */
    constructor(DOM_object, ds_root, ds_rootType){

        DOM_object = DOM_object || document
        this.ds_root = ds_root || window /* Data Source root */
        
        this.$qsa = DOM_object.querySelectorAll.bind(DOM_object) //* DOM_object is not needed anymore
    
        this.defineConstants()
        
        this.bindings_byPath = {}   /** object contains Arrays of elems subscribing to a pathString 
                                        bindings_byPath.pathString = [{elem, pathName}, {elem2, pathName2}]
                                     */
        
        this.scan_DOM_object()      /** scan DOM page and find all controls with databinding 
                                        (NOTE: elements created by document.createElement(), have events on JS instance of HTMLElement)
                                        elements added AFTER new AlfaDatabinding() have to be added: alfaDatabinding.scan_Elem_container(container)
                                    */
    }

    defineConstants(){
        this.ds_root.dsConst = {
            TRUE: true,
            FALSE: false,
            ZERO: 0,
            ONE: 1,
            NULL: null,
            EMPTY: ''
        } 
    }
    
  
    scan_DOM_object(){ /** scan DOM_object and find all elements with databinding */

        //* global approach
        this.$qsa('*').forEach(function(elem){
            this.createElementBinding(elem, {caller:'scan_DOM_object'})
        }.bind(this))

        console.log(LOG_PREF, {bindings_byPath: this.bindings_byPath})
    }

    //* after alfaDatabinding is already constructed and new elements are added to DOM
    scan_Elem_container(container_elem_or_selector){
        var container
        if(typeof container_elem_or_selector==='string'){container = document.querySelector(container_elem_or_selector)}
        else {container = container_elem_or_selector}

        container.querySelectorAll('*').forEach(function(elem){
            this.createElementBinding(elem, {refreshScan:true, caller:'scan_Elem_container'})
        }.bind(this))
        console.log(LOG_PREF, {bindings_byPath: this.bindings_byPath})
    }

  
    createElementBinding(elem, opts={}){  //* opts.refreshScan
        //* 1. check if elem has binding
        //*         bound_path - two way binding
        //*         bound_path_out - one way binding

        var hasOnChangeListener, hasBinding
        elem.alfa_bindings = []

        hasBinding = this.process_bound_path_attrs(elem, opts)    //* populates elem.alfa_bindings and  this.bindings_byPath

        if(!hasBinding){delete elem.alfa_bindings; return} // -------------- >
        if(hasBinding==='bound_calculated') return // --- >

        /** 2. process the element

        /** 2a. make event */
        if(elem.tagName==='INPUT' || elem.tagName==='SELECT' || elem.tagName==='TEXTAREA'){
            if(elem.hasAttribute('on-input')){elem.addEventListener('input', this.onInputElemChange.bind(this))}
            else                             {elem.addEventListener('change', this.onInputElemChange.bind(this))}
            hasOnChangeListener = true
        }

        /** 2b. for <SELECT>, start with blank choice */
        if(elem.tagName==='SELECT' && elem.hasAttribute('start-blank')){
            elem.selectedIndex = -1
        }
       


        //*  if(elem.hasAttribute('bound_onchange') ) this custom defined function will run AFTER defauld onchange handler

        //* at the end, assing values to new elements if their datapaths point to datatstore with values
        if(opts.refreshScan){ //* scan_Elem_container(cont, opts.refreshScan) is used when adding new html elems after new AlfaDatabinding() did original scan
            var pathString = elem.getAttribute('bound_path')
            var value = getPropertyByPath(this.ds_root, pathString)
            if(typeof value !=='undefined')
                this.element_setValue(elem, value, {pathName:'bound_path', pathString})
        }
    }

    bound_onchange_customHandler(elem, value){ //* bound_onchange attribute contains function name
        if(!elem.hasAttribute('bound_onchange')) return // ---- >

        //* 'bound_onchange' NOT data-path but the name of a function !!!
        var fnName = elem.getAttribute('bound_onchange')
        //* find the callback function, it can be attached to host object or global
        var fnRoot
        if(typeof this.ds_root[fnName] === 'function') {fnRoot = this.ds_root}
        else if(typeof  window[fnName] === 'function') {fnRoot = window}
        if(!fnRoot){console.error(LOG_PREF, `fnName() bound_onchange="${fnName}" function not found!`, elem); return}
        fnRoot[fnName]({value, elem})
    }

    process_bound_path_attrs(elem, opts){
        
        if(!elem.alfa_bindings){elem.alfa_bindings = []} //* REMEMBER: elem is a JS object, not DOM HTMLElement

        var hasBinding
        var attrs = Array.prototype.slice.call(elem.attributes) //* bound_path attributes
        attrs.forEach(function(attr){
            if(attr.name.startsWith('bound_path')){
                hasBinding = true

                var pathName = attr.name,   //* ie: 'bound_path_out'
                    pathString = attr.value     //* ie: 'dsPage.in1'    

                /** needed when element onChange fires 
                 *  here elem is an JavaScript Object, NOT HTMLelement! HTMLelement is a browser object and can not be extended with new argument or method   */
                elem.alfa_bindings.push({
                    pathName,       //* ie: 'bound_path'   
                    pathString      //* ie: 'dsPage.arg'
                })

                //* put elem into subscription list of pathString
                this.bindings_byPath[pathString] = this.bindings_byPath[pathString] || []
                this.bindings_byPath[pathString].push({elem, pathName})

                //* if(opts.refreshScan) all elems in the container are added to existing elems in bindings_byPath
                //* causing HARMLESS duplication. To avoid that, use new empty container
                //* duplication can not be detected because some elems are JS objects based on HTMLElements and some are real DOM HTMLElements
            } 
            else if(attr.name==='bound_calculated'){
                hasBinding = 'bound_calculated' //* this setting will prevent the element to have 'change' event
                new CalculatedField({alfaDatabinding_instance: this, elem, formula: attr.value}) //* instance of CalculatedField is attached to elem
            }
        }.bind(this))
        return hasBinding
    }


   
    //* event handler, also can be called as a function with elem argument
    onInputElemChange(ev, elem){  /** handler of event 'change', the listener is added by this.createElementBinding() */

        var elem = elem || ev.target

        if(elem.tagName==='INPUT' && elem.getAttribute('type')==='radio'){this.onChange_radio(elem); return} // --- >

        /** element on change sends value OUT either to bound_path or bound_path_out     */
        var pathOut, bound_path_out
            
        /* find pathNames for sending data out      */
        elem.alfa_bindings.forEach(function(binding){
            /* only bound_path and bound_path_out can send data out on change
            * if elem has bound_path_out, change will be sent there         */
            if(binding.pathName === 'bound_path_out'){ /* bound_path_out has priority over bound_path  */
                pathOut = binding.pathString
                bound_path_out = true
            } else {
                if(!pathOut && binding.pathName === 'bound_path'){pathOut = binding.pathString}
            }
            /* other pathNames are not sending data out     */
        })

        /* elements based on Array should have bound_path_out  */
        if((elem.tagName==='INPUT' && elem.getAttribute('type')==='search') || elem.tagName==='SELECT' || elem.tagName==='TABLE'){
            if(!bound_path_out){console.warn(LOG_PREF, elem.tagName, 'does not have bound_path_out and on-change is ignored!', elem); return }
        }

       
        var value = this.elem_getValue(elem)
        // this.elem_setValue(elem, value, pathOut)
        this.set(pathOut, value, elem, console.error) 

        //* run optional customer defined event handler
        this.bound_onchange_customHandler(elem, value)
    }

    onChange_radio(elem){

        var bound_path_out = elem.getAttribute('bound_path_out')
        var bound_value    = elem.getAttribute('bound_value')

        if(bound_value){
            this.set(bound_path_out, bound_value, elem, console.error)
        } else {
            var label = elem.closest('label')
            if(label && label.tagName==='LABEL'){
                this.set(bound_path_out, label.innerText, elem, console.error)
            } else {
                console.error(LOG_PREF, 'radio group has not defined value')
            }
        }
        
        // this.bound_onchange_Handler(elem, value)
    }

    //* called by notifySubscribers() and opts.refreshScan
    element_setValue(elem, value, {pathName, pathString}){
        // //* simplification
        // elem.value = value
        // elem.innerText = value
        // /////////////////////////

        // did NOT help
        // if(typeof value_or_obj==='object'){ value = JSON.parse(JSON.stringify(value_or_obj))
        // } else {                            value = value_or_obj        }

        if(pathName==='bound_calculated'){elem.calculatedField.calculate(elem, value, pathString); return} //* in this case pathString is a part of formula

        /** use show-undefined for debugging */
        if(!elem.hasAttribute('show-undefined') && typeof value==='undefined'){value = null}

        // /** web-component */
        // if(elem.tagName.includes('-')){
        //     if(elem.databinding_setValue){
        //         elem.databinding_setValue(value, pathName, opts)    /** web-component has to have it's own method to handle the new value */
        //         return  // --- >
        //     } else {
        //         logWarn.call(this, elem.tagName, 'does not have databinding_setValue() function OR is not ready!')
        //     }
        // }
        // // if(elem.tagName.includes('-') && elem.databinding_setValue){
        // //     elem.databinding_setValue(value, pathName, opts)    /** web-component has to have it's own method to handle the new value */
        // //     return  // --- >
        // // }
    
        if(pathName==='bound_path'){
    
            // if(elem.tagName==='INPUT' && elem.getAttribute('type')==='checkbox'){
            if(elem.tagName==='INPUT' && elem.type==='checkbox'){
                elem.checked = value
            }
            else if(elem.tagName==='INPUT' && elem.type==='search' && elem.hasAttribute('bound_path')){
                makeHtml.DATALIST(elem, value)
            }
            // else if(elem.tagName==='INPUT' && elem.type==='radio'){}
            else if(elem.tagName==='INPUT' && elem.hasAttribute('from-json')){  /** input with JSON string to be converted to Object */
                elem.value = value
                var boundPathOut = elem.alfa_bindings.find(function(item){
                    return item.pathName==='bound_path_out'
                })
                if(!boundPathOut){console.error(LOG_PREF, '<input from-json> must have bound_path_out!', elem) } 
                else {
                    var valueOut;
                    try{valueOut = JSON.parse(value)} catch(err){
                        console.error(LOG_PREF, {message:'<input from-json>'+ err.message}, elem) 
                    }
                    this.set(boundPathOut.pathString, valueOut, elem)
                }
            } 
            else if(elem.tagName==='INPUT'){  /** input has value attribute */
                elem.value = value
            } else if(elem.tagName==='SELECT' || elem.tagName==='DATALIST'){
                // this.make_html_options(elem, value)
                makeHtml.OPTIONs(elem, value)

            } else if(elem.tagName==='TABLE'){
                // this.make_html_table(elem, value)
                makeHtml.TABLE(elem, value, {alfaDatabinding_instance: this})
            } else if(elem.tagName==='PRE' && elem.hasAttribute('to-json')){
                elem.innerText =  JSON.stringify(value, null, 4)
            } else if(elem.tagName==='TEXTAREA' && elem.hasAttribute('edit-json')){
                elem.innerHTML =  JSON.stringify(value, null, 4)
            
            // } else if(elem.tagName.includes('-')){ /** web-component */
            //     elem.databinding_setValue(value, pathName, opts)    /** web-component has to have it's own method to handle the new value */
            } else {            /** span has not */
                //* format in readonly elements
                if(elem.hasAttribute('format-date')){
                    if(typeof value!=='undefined' && value!==null)
                        value = new Date(value).toLocaleDateString()
                }
                elem.innerText = value
            }
        } else if(pathName==='bound_path_out'){ /* do nothing, in case of <input type=radio> */
        } else {
            this.elem_action(elem, value, pathName)
        }
    }

    // elem_setValue(elem, value, pathName){
    //     //* simplification
    //     this.set(pathName, value, elem, console.error) 
    // }
    elem_getValue(elem){
    
        if(elem.tagName==='INPUT' && elem.getAttribute('type')==='checkbox'){
            return elem.checked }
        else if(elem.tagName==='INPUT' && elem.getAttribute('type')==='number'){ // new: 2021.11.30
            return parseFloat(elem.value)
        } else
            return elem.value
    }

    elem_action(elem, value, pathName){
    
        switch(pathName){
            case 'bound_path_disabled':
                if(value) {elem.setAttribute('disabled', '')} else {elem.removeAttribute('disabled')}; break
            case 'bound_path_disabled_onfalse':
                if(!value) {elem.setAttribute('disabled', '')} else {elem.removeAttribute('disabled')}; break
            case 'bound_path_hidden':
                if(value) {
                    elem.style.display = 'none'
                } else {
                    /** unhiding needs to know the display before hide */
                    var visibleDisplay = elem.getAttribute('visible-display') || 'unset'
                    elem.style.display = visibleDisplay
                }; break
            case 'bound_path_select_item':      /** selecting by value in <SELECT><OPTION> */
                if(elem.tagName==='SELECT'){
                    var options =  elem.querySelectorAll('option')
                    
                    if(value && options.length===0){ //* a. value is being assigned, but there is no selection list
                        this.make_html_options(elem, [value]) //* make list with one item
                    }
                   //* select item from existing selection list
                    options.forEach(function(item, i){
                        if(item.value===value){
                            elem.selectedIndex = i
                            var pathOut = elem.getAttribute('bound_path_out')
                            this.set(pathOut, value, elem)
                        }
                    }.bind(this))
                }
                if(elem.tagName==='INPUT' && elem.getAttribute('type')==='search'){
                    var datalist = elem.list
                    var options =  datalist.querySelectorAll('option')
                    //* select item from existing selection list
                    options.forEach(function(item, i){
                        if(item.value===value){
                            elem.value = value
                            var pathOut = elem.getAttribute('bound_path_out')
                            this.set(pathOut, value, elem)
                        }
                    }.bind(this))
                }
                break
            case 'bound_path_select_by_index':
                if(elem.tagName==='TABLE'){
                    var tr = elem.querySelector(`[row-index="${value}"]`)
                    if(tr){
                        makeHtml.on_tableRowClick.call({alfaDatabinding: this, tableElem: elem}, {target: tr})
                    }
                }
                // if(elem.tagName==='INPUT' && elem.getAttribute('type')==='search'){} ???
                break
            case 'bound_path_clear_selected':
                var supportedElem
                if(elem.tagName==='TABLE'){
                    supportedElem = elem
                    var trs = elem.querySelectorAll('tr')
                    trs.forEach(function(tr){
                        tr.removeAttribute('row-selected')
                    })
                }
                if(elem.tagName==='SELECT'){
                    supportedElem = elem
                    elem.selectedIndex = -1
                }
                if(elem.tagName==='INPUT' && elem.getAttribute('type')==='search'){
                    supportedElem = elem
                    elem.selectedIndex = -1
                    elem.value = null
                }
                if(supportedElem){
                    var pathOut = elem.getAttribute('bound_path_out')
                    this.set(pathOut, null, null)
                }
                break
        }
    }

    //* **********************************************************
    set(path, value, settingElem, errCallback, opts={}){

        var fnName = opts.delete ? 'del' : 'set'
        if(typeof path !=='string'){   console.error(LOG_PREF, `${fnName}(path, value) path is not a string!`, {path, value, settingElem}); return} 
        if(path.startsWith('dsConst')){console.error(LOG_PREF, `${fnName}() can not change CONSTANT:`, {path, value, settingElem}); return}  
        if(typeof settingElem==='undefined'){console.error(LOG_PREF, `function ${fnName}(path, value, settingElem) has 3 required args, settingElem can be null, but not undefined.`, {path, value, settingElem}) ; return} 
        opts.caller = fnName

        /** @param 'this.ds_root' is a root object of dataSources  */
        setPropertyByPath(this.ds_root, path, value, errCallback, opts)

        this.notifySubscribers(path, value, settingElem, opts)
    }
    get(path, errCallback){
        // console.log(window.dsPage.lookups.Equipment2)
        // var temp = getPropertyByPath(this.ds_root, path, errCallback)
        return getPropertyByPath(this.ds_root, path, errCallback)
    }
    delete(path, errCallback){
        this.set(path, undefined, null, errCallback, {delete: true}) //* 1. clear UI by notifying subscribers
        delPropertyByPath(this.ds_root, path, errCallback)  //* 2. delete the variable
    }
    //* **********************************************************

    notifySubscribers(pathString, value, settingElem, opts={}){ //* ie: pathString = 'ds.root.branch'

        var bindings_byPath = this.bindings_byPath

        if(!Array.isArray(bindings_byPath[pathString])) return // ----- >

        // //* setVal_inSubscr
        // if(opts.children) {
        //     console.log(`%cnotifySubscribers() childrenOf:${opts.childrenOf}`, 'background:pink', {pathString, value})
        // }

        /** 1. check if exact pathString does have subscribers */                           
        bindings_byPath[pathString].forEach(function(item){
            var elem = item.elem
            var pathName = item.pathName  //* ie: 'bound_path'

            if(pathName ==='bound_path_out'){return} // --- >

                                        //* strict equality, similar to Object.is(elem, settingElem) 
            if(elem !==settingElem){ //* prevent assigning a value to element which initiated the notification of subscribents
                
                this.element_setValue(elem, value, {pathName, pathString})
                
                // log(`1.setVal_inSubscr(exact match)`, {pathString}, elem)
            }
        }.bind(this))

        if(opts.refreshAll && !value){ return } // from refershAllSubscribers() --- >
        // OLD if(opts.children) return

        //* 2. check if partial pathStr does have subscibers ...
        for(let pathStr in bindings_byPath){

            /** 2a. check if pathString children do have subscribers */
            if(pathStr.startsWith(pathString)){
                if(isPartialPath(pathStr, {dotPosition: pathString.length})) break  // terminate for() loop --- >

                bindings_byPath[pathStr].forEach(function(item){
                    var elem = item.elem
                    var pathName = item.pathName
                    if(elem !==settingElem){

                        /*  value passed into notifySubscribers() is the value of child,
                            we are notifying parent,
                            find current value of parent                        */
                        value = this.get(pathStr, console.error) //* no need to bind(this)
            
                        //OLD this.elem_setValue(elem, value, pathName, {pathString})
                        this.element_setValue(elem, value, {pathName, pathString})
                        log('2.setVal_inSubscr(Kid)', {pathString}, elem)
                    }
                }.bind(this))
            }
        }

        /** 3. check if path parents have subscribers 
         *      has to be separate forloop because loop above has a break !!!
        */
        for(let pathStr in bindings_byPath){
            if(pathStr===pathString) continue // this was handled in step 1

            if(pathString.startsWith(pathStr) && bindings_byPath[pathStr]){

                if(isPartialPath(pathString, {dotPosition: pathStr.length})) continue // go to next in for() loop --- >

                bindings_byPath[pathStr].forEach(function(item){
                    var elem = item.elem
                    var pathName = item.pathName
                    if(elem !==settingElem){

                        /*  value passed into notifySubscribers() is the value of child,
                            we are notifying parent,
                            find current value of parent                        */
                        value = this.get(pathStr, console.error)

                        //OLD this.elem_setValue(elem, value, pathName, {pathString})
                        this.element_setValue(elem, value, {pathName, pathString})
                        log('3.setVal_inSubscr(Parent)', {pathString}, elem)
                    }
                }.bind(this))

            }
        }

// return  // PROBLEM - UI field gets value, but wipes out the value in dataSource, problem solved in getPropertyByPath() which was assinging value!!!

        /** 4. check if current node, which has a new value assigned, has children (22.1.5) */
        for(let pathStr in bindings_byPath){
            if(pathStr===pathString) continue // disregard

            if(pathStr.startsWith(pathString) && bindings_byPath[pathStr]){

                if(isPartialPath(pathStr, {dotPosition: pathString.length})) continue // go to next in for() loop --- >

                //* get current value
                value = this.get(pathStr, console.error)

               var bindings = bindings_byPath[pathStr]
               bindings.forEach(function(binding){
                    log('4.setVal_inSubscr()', {pathStr, pathString}, binding.elem)
                    this.element_setValue(binding.elem, value, {pathName: binding.pathName, pathString})
               }.bind(this))
            }
        }

        

        //* helpers **************************************
        /* check if path is a partial path of object */
        function isPartialPath(pathToCheck, {dotPosition}){
            if(pathToCheck.charAt(dotPosition)==='.'){
                return false
            } else {
                return true;  /*  pathToCheck coicidentially starts with similar chars as other path */
            }
        }
    }//end: notifySubscribers()


    //* refershAllSubscribers() - bound_paths can be orphaned when upper param is assigned a literal value
    /*      example:
            ds.root.branch1.leaf1.bud1 = 'paczek'
            then
            ds.root.branch1 = 'galazka'
            bud1 and leaf1 do not exist anymore and their bound values should be refershed

        this is already handled in notifySubscribers() step 4.    */
    refershAllSubscribers(){

        var bindings_byPath = this.bindings_byPath

        for(let pathStr in bindings_byPath){

            var value = this.get(pathStr)
            this.notifySubscribers(pathStr, value, null, {refreshAll: true})
        }
    }

}

export {AlfaDatabinding, alfaMath}


class CalculatedField { //* added to JS instance of HTMLElement

    constructor({alfaDatabinding_instance, elem, formula}){ //* formula is a string from attribute bound_calculated="ds.varA ds.varB +"

        elem.calculatedField = this

        this.alfaDatabinding_instance = alfaDatabinding_instance
        this.formula = formula

        this.operands = {}
     
        formula = formula.trim()
        var parts = formula.split(' ')

        parts.forEach(function(pathString){
            if(alfaMath.isOperator(pathString)) return

            //* create list of operands
            this.operands[pathString] = undefined

            alfaDatabinding_instance.bindings_byPath[pathString] = alfaDatabinding_instance.bindings_byPath[pathString] || []
            alfaDatabinding_instance.bindings_byPath[pathString].push({elem, pathName: 'bound_calculated'})

        }.bind(this))
    }

    //* RPN: operand, operand, operator

    calculate(elem, value, pathString){ //* in this case pathString is an operand part of formula
                                        /*  all operand values have to be gathered before the calculation can be made         */

        this.operands[pathString] = value

        var hasAllOperandValues = true
        for(var operand in this.operands){
            var operandValue = this.operands[operand]
            if(typeof operandValue ==='undefined') hasAllOperandValues = false
        }

        if(hasAllOperandValues){
            var {result, errors} = this.execute_formula()
            result = typeof result ==='undefined' ? 'ERR ' : result
            
            //* display result
            elem.value = result
            elem.innerText = result

            //* notify subscribers if elem has bound_path_out
            if(elem.hasAttribute('bound_path_out')){
                var path = elem.getAttribute('bound_path_out')
                this.alfaDatabinding_instance.notifySubscribers(path, result, elem)
            }

            if(errors.length > 0){
                elem.style.color = 'red'
                console.error(`execute_formula: '${this.formula}'`, {errors})
            }
        }
    }

    execute_formula(){
        
        var formula = this.formula.trim()

        var expression = '', errors = [], err = false
        var expressionParts = formula.split(' ')

        expressionParts.forEach(function(part){

            if(!alfaMath.isOperator(part)){
                
                var val = this.operands[part]

                if(val===null | val===''){ //* val expected to be numeric
                    var message = `value of '${part}' is missing!`
                    errors.push(message)
                    console.error(LOG_PREF, `execute_formula() ${message}`, {formula})
                }
                expression += val + ' '
            } else { 
                expression += part + ' '
            }
        }.bind(this))

        var result = alfaMath.reversePolish(expression.trim())
        if(typeof result==='undefined'){errors.push('RPN stack not empty')}
        return {result, errors}
    }
}


const $dce = document.createElement.bind(document)

class MakeHtml {

    constructor(){}

    /** for <select><option> and <datalist><option>
     * @param parentElem - <select> or <datalist> html element
     * @param list - Array [{'item name': value}, ...]
     */
    OPTIONs(parentElem, list){

        if(!Array.isArray(list)){console.error('[makeHtml].OPTIONs() list is not an Array!', parentElem); return} 
       
        clearNode(parentElem)  // parentElem.innerHTML = ''
    
        if(parentElem.hasAttribute('first-empty')){list.unshift({'': null})} /** good to have for unselecting */
    
        list.forEach(function(item){
            var itemName, itemValue
    
            if(typeof item==='object'){ /** expected format: {'item name': value} */
                for(itemName in item){itemValue = item[itemName]}
                if(parentElem.hasAttribute('text-value')){itemName = `${itemName}: ${itemValue}` }
                if(parentElem.hasAttribute('value-text')){itemName = `${itemValue}: ${itemName}` }
                if(parentElem.hasAttribute('value-only')){itemName = itemValue }
            } else {                    /** expected string */
                itemName = item
                itemValue = item
            }
    
            var option = $dce('option')
            option.text = itemName
            option.value = itemValue
            parentElem.append(option)
        })
    
        if(parentElem.hasAttribute('start-blank')){parentElem.selectedIndex = -1}
    
    }

    DATALIST(parentElem, list){
        if(!Array.isArray(list)){console.error('[makeHtml].DATALIST() list is not an Array!', parentElem); return} 

        var datalist = $dce('datalist')
        datalist.id = uuidv4()
        parentElem.setAttribute('list', datalist.id )

        this.OPTIONs(datalist, list)

        parentElem.insertAdjacentElement('beforebegin', datalist)

    }

    //make_html_table(tableElem, tableData){
    TABLE(tableElem, tableData, args){  //* args.alfaDatabinding_instance
    
        clearNode(tableElem) // tableElem.innerHTML = ''

        this.alfaDatabinding_instance = args.alfaDatabinding_instance

        //* create table header from first line of tableData
        var thead = $dce('thead')
        var tr = $dce('tr')
        var row = tableData[0]
        var colName = Object.keys(row)[0]
        for(colName in row){
            var th = $dce('th')
            th.innerHTML = colName
            tr.append(th)
        }
        thead.append(tr)

        tableElem.append(thead)

        //* create table body
        var tbody = $dce('tbody')
        tableData.forEach(function(row, i){
            var tr = $dce('tr')
            tr.setAttribute('row-index', i)
            for(var colName in row){
                var td = $dce('td')
                td.innerHTML = row[colName]
                tr.append(td)
            }
            // tr.addEventListener('click', this.onTblRowClick.bind({alfaDatabinding: this, tableElem}))
            tr.addEventListener('click', this.on_tableRowClick.bind({makeHtml: this, tableElem}))
            tbody.append(tr)
        }.bind(this))
        tableElem.append(tbody)
    }

    on_tableRowClick = function(ev){

        /** bind({alfaDatabinding: this, tableElem}) 
         *  or
         *  call({alfaDatabinding: this, tableElem: elem}, {target: tr})
        */
    
        if(!this.makeHtml){this.makeHtml = {alfaDatabinding_instance: this.alfaDatabinding}} //* called from outside

        if(this.tableElem.hasAttribute('disabled')) return
    
        var tr = ev.target.closest('tr')
    
        var index = tr.getAttribute('row-index')
        var pathIn = this.tableElem.getAttribute('bound_path')
        var pathOut = this.tableElem.getAttribute('bound_path_out')
    
        if(pathOut){
            var sourceArr = this.makeHtml.alfaDatabinding_instance.get(pathIn)
    
            this.makeHtml.alfaDatabinding_instance.set(pathOut, sourceArr[index], this.tableElem)
        } else {
            console.error(`'[makeHtml].on_tableRowClick(${index}) bound_path_out is falsy!`); return
        }

        
        bound_onrowselect_customHandler.call(this, tr, sourceArr[index])
    
        /** making slected attr for use by hostpage CSS */
        var trs = this.tableElem.querySelectorAll('tr')
        trs.forEach(function(tr){
            tr.removeAttribute('row-selected')
        })
        tr.setAttribute('row-selected', '')

        /////////////////////////////
        
        function bound_onrowselect_customHandler(tr, rowData){

            if(!this.tableElem.hasAttribute('bound_onrowselect')) return // ---- >
           
            //* 'bound_onrowselect' NOT data-path but the name of a function !!!
            var fnName = this.tableElem.getAttribute('bound_onrowselect')
            //* find the callback function, it can be attached to host object or global
            var fnRoot
            var ds_root = this.makeHtml.alfaDatabinding_instance.ds_root
            if(typeof ds_root[fnName] === 'function') {fnRoot = ds_root}
            else if(typeof  window[fnName] === 'function') {fnRoot = window}
            if(!fnRoot){console.error(LOG_PREF, `bound_onrowselect="${fnName}" function not found!`, table); return}
            fnRoot[fnName]({rowData, tr})
        }
    }
    
   
}
const makeHtml = new MakeHtml()

function clearNode(myNode){
    while (myNode.firstChild) {
        myNode.removeChild(myNode.lastChild);
    }
}
function uuidv4() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

class AlfaMath{ //* RPN

    constructor(){

        //* supported operators
        this.operators = ['+', '-', '*', '/', '^']
    }

    reversePolish(newExpr) {

        let expr = newExpr.split(' ')
        let stack = []
        if(expr === ''){ return 0 } // --- >

        for(let i=0; i < expr.length; i++) {
            if(!isNaN(expr[i]) && isFinite(expr[i])) {
                stack.push(expr[i])
            } else {
                let a = stack.pop()
                let b = stack.pop()
                if(expr[i] === '+') {
                    stack.push(parseFloat(a) + parseFloat(b))
                } else if(expr[i] === '-') {
                    stack.push(parseFloat(b) - parseFloat(a))
                } else if(expr[i] === '*') {
                    stack.push(parseFloat(a) * parseFloat(b))
                } else if(expr[i] === '/') {
                    stack.push(parseFloat(b) / parseFloat(a))
                } else if(expr[i] === '^') {
                    stack.push(Math.pow(parseFloat(b), parseFloat(a)))
                }
            }
        }
        if(stack.length > 1){ return  } 
        else {                return stack[0] }
    }

    isOperator(str){
        return this.operators.includes(str)
    }
}
const alfaMath = new AlfaMath()