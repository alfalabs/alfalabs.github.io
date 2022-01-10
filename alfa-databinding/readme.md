# alfa-databinding

Databinding is not new in JavaScript programming of web UI.
All existing databinding technologies are a part of some framework (ie: BackboneJS, AngularJS) or UI library (ie: Polymer)
Frameworks are usually heavy and very restrictive to what framework design provides. 

As a software engineer I do not say to my customers: *"Can not do this because my framework does not have this functionality."*
I say: *"**Yes**, anything can be done as long as it makes logical sense."*

## No Code

There is a fashionable trend: "No Code App Builder."   
This sounds like a marketing phrase, because it is. "No code" still means a little code or some configuration code.

I like the "No Code App Builder" concept: 

- building new application using existing modules (like assembling building blocks)

- dynamically creating User Interface based on configuration 

- writing as little code as possible. 

I had a need to create a very light library providing databinding functionality, based on what already exists in every browser: 
**native HTML Elements.**

Any HTML Element can have a binding. This element can receive user input to be propagated to all other HTML Elements "subscribing" to the same binding.  
Without writing any code, the data is being updated in UI in the web application.

```alfa-databinding``` handles these main tasks

- data binding to a variable and notification of subscribers
- perform action when data changes, disable, hide
- handle user selection or choice in HTML Elements with selection capabilities 
- perform arithmetic calculations with live update of the result as the input data changes

