/*
*     (C) Copyright 2008 Telefonica Investigacion y Desarrollo
*     S.A.Unipersonal (Telefonica I+D)
*
*     This file is part of Morfeo EzWeb Platform.
*
*     Morfeo EzWeb Platform is free software: you can redistribute it and/or modify
*     it under the terms of the GNU Affero General Public License as published by
*     the Free Software Foundation, either version 3 of the License, or
*     (at your option) any later version.
*
*     Morfeo EzWeb Platform is distributed in the hope that it will be useful,
*     but WITHOUT ANY WARRANTY; without even the implied warranty of
*     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
*     GNU Affero General Public License for more details.
*
*     You should have received a copy of the GNU Affero General Public License
*     along with Morfeo EzWeb Platform.  If not, see <http://www.gnu.org/licenses/>.
*
*     Info about members and contributors of the MORFEO project
*     is available at
*
*     http://morfeo-project.org
 */


function VarManager (_workspace) {

    VarManager.prototype.MAX_BUFFERED_REQUESTS = 10

    // ****************
    // PUBLIC METHODS
    // ****************


    VarManager.prototype.parseVariables = function (workspaceInfo) {
        // Iwidget variables!
        var tabs = workspaceInfo['tabs'];

        for (var i=0; i<tabs.length; i++) {
            var iwidgets = tabs[i]['iwidgets'];

            for (var j=0; j<iwidgets.length; j++) {
                this.parseIWidgetVariables(iwidgets[j], this.workspace.getTab(tabs[i].id));
            }
        }
    }

    /**
     * Saves all modified variables.
     *
     * @param {Boolean} async if true, this method will do some asynchronous
     * tasks. Sometimes these operations cannot be done asynchronously
         * because the browser will not wait for these operations. (default:
         * true)
     */
    VarManager.prototype.sendBufferedVars = function (async) {
        async = async !== false;

        // Asynchronous handlers
        function onSuccess(transport) {
        }

        function onError(transport, e) {
            Wirecloud.GlobalLogManager.formatAndLog(gettext("Error saving variables to persistence: %(errorMsg)s."), transport, e);
        }

        // Max lenght of buffered requests have been reached. Uploading to server!
        if (this.iwidgetModifiedVars.length > 0) {
            var uri = Wirecloud.URLs.VARIABLE_COLLECTION.evaluate({workspace_id: this.workspace.id});

            var options = {
                method: 'POST',
                asynchronous: async,
                contentType: 'application/json',
                requestHeaders: {'Accept': 'application/json'},
                postBody: JSON.stringify(this.iwidgetModifiedVars),
                onSuccess: onSuccess.bind(this),
                onFailure: onError.bind(this),
                onException: onError.bind(this)
            };
            Wirecloud.io.makeRequest(uri, options);
            this.resetModifiedVariables();
        }
    }

    VarManager.prototype.parseIWidgetVariables = function (iwidget_info, tab, iwidget) {
        var name, id, variables, variable, iwidget, varInfo, aspect, value,
            objVars = {};

        if (iwidget == null) {
            iwidget = this.workspace.getIWidget(iwidget_info['id']);
        }
        variables = iwidget.widget.variables;

        for (name in variables) {
            variable = variables[name];
            varInfo = name in iwidget_info.variables ? iwidget_info.variables[name] : {};

            id = varInfo.id;
            aspect = variable.aspect;
            value = 'value' in varInfo ? varInfo.value : '';

            switch (aspect) {
                case Variable.prototype.PROPERTY:
                    objVars[name] = new RWVariable(id, iwidget, variable, this, value, tab);
                    this.variables[id] = objVars[name];
                    break;
            }
        }

        this.iWidgets[iwidget_info['id']] = objVars;
    }

    VarManager.prototype.getVariable = function (iWidgetId, variableName) {
        var variable = this.findVariable(iWidgetId, variableName);

        // Error control

        return variable.get();
    }

    VarManager.prototype.setVariable = function (iWidgetId, variableName, value, options) {
        var variable = this.findVariable(iWidgetId, variableName);

        variable.set(value, options);
    }

    VarManager.prototype.addInstance = function addInstance(iWidget, iwidgetInfo, tab) {
        this.parseIWidgetVariables(iwidgetInfo, tab, iWidget);
    };

    VarManager.prototype.removeIWidgetVariables = function (iWidgetId) {
        var i, variable_id, variable;

        for (variable_id in this.variables) {
            variable = this.variables[variable_id];
            if (variable.iWidget === iWidgetId) {
                for (i = 0; i < this.iwidgetModifiedVars.length; i++) {
                    if (this.iwidgetModifiedVars[i].id == variable_id) {
                        this.iwidgetModifiedVars.splice(i, 1);
                    }
                }
                delete this.variables[variable_id];
            }
        }
    }

    VarManager.prototype.unload = function () {
    }

    VarManager.prototype.commitModifiedVariables = function() {
        //If it have not been buffered all the requests, it's not time to send a PUT request
        if (!this.force_commit && this.buffered_requests < VarManager.prototype.MAX_BUFFERED_REQUESTS) {
            this.buffered_requests++;
            return
        }

        this.sendBufferedVars();
    }

    VarManager.prototype.initializeInterface = function () {
        // Calling all SLOT vars handler
        var variable;
        var vars;
        var varIndex;
        var widgetIndex;

        for (widgetIndex in this.iWidgets) {
        vars = this.iWidgets[widgetIndex];

            for (varIndex in vars) {
                variable = vars[varIndex];

                if (variable.vardef.aspect == "SLOT" && variable.handler) {
                    try {
                        variable.handler(variable.value);
                    } catch (e) {
                    }
                }
            }

        }
    }

    VarManager.prototype.findVariableInCollection = function(varCollection, id){
        for (var i = 0; i < varCollection.length; i++){
            var modVar = varCollection[i];

            if (modVar.id == id) {
                return modVar
            }
        }
        return null;
    }


    VarManager.prototype.markVariablesAsModified = function (variables) {
        for (var j = 0; j < variables.length; j++) {
            var variable = variables[j];

            var modVar = this.findVariableInCollection(this.iwidgetModifiedVars, variable.id)
            if (modVar) {
                modVar.value = variable.value;
                return;
            }

            //It's doesn't exist in the list
            //It's time to create it!
            var varInfo = {
                'id': variable.id,
                'value': variable.value
            }

            this.iwidgetModifiedVars.push(varInfo);
        }
    }

    VarManager.prototype.resetModifiedVariables = function () {
        this.buffered_requests = 0;
        this.iwidgetModifiedVars = [];
        this.force_commit = false;
    }

    VarManager.prototype.forceCommit = function(){
        this.force_commit = true;
    }

    VarManager.prototype.getIWidgetVariables = function (iWidgetId) {
        return this.iWidgets[iWidgetId];
    }

    // *********************************
    // PRIVATE VARIABLES AND CONSTRUCTOR
    // *********************************

    VarManager.prototype.findVariable = function (iWidgetId, name) {
        var variables = this.iWidgets[iWidgetId];
        var variable = variables[name];

        return variable;
    }

    this.workspace = _workspace;
    this.iWidgets = {};
    this.variables = {};

    this.workspace.addEventListener('iwidgetremoved', function (iwidget) {
        delete this.iWidgets[iwidget.id];

        this.removeIWidgetVariables(iwidget.id);
    }.bind(this));

    // For now workspace variables must be in a separated hash table, because they have a
    // different identifier space and can collide with the idenfiers of normal variables
    this.resetModifiedVariables();

    // Creation of ALL Wirecloud variables regarding one workspace
    this.parseVariables(this.workspace.workspaceState);
}
