/*
    Copyright (c) 2019, Salesforce.org
    All rights reserved.

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of Salesforce.org nor the names of
      its contributors may be used to endorse or promote products derived
      from this software without specific prior written permission.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
    "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
    LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
    FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
    COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
    INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
    BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
    LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
    CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
    LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
    ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
    POSSIBILITY OF SUCH DAMAGE.
*/
/**
* @author Salesforce.org
* @date 2019
* @group Recurring Donations
* @description Controller extension for enhanced Recurring Donation enablement panel
*/
public with sharing class RD2_EnablementDelegate_CTRL extends STG_Panel {

    /***
    * @description Returns Day of Month field picklist value specific to enhanced Recurring Donations
    */
    @TestVisible 
    private static String dayOfMonthPicklistValue {
        get {
            if (dayOfMonthPicklistValue == null) {
                dayOfMonthPicklistValue = RD2_Constants.DAY_OF_MONTH_LAST_DAY;
            }
            return dayOfMonthPicklistValue;
        }
        set;
    }

    /***
    * @description A unique enhanced Recurring Donation enablement panel Id
    */
    public override String idPanel() { 
        return 'idPanelRD2Enablement'; 
    }

    /***
    * @description NPSP namespace: an empty string if unmanaged, or 'npsp' if managed
    */
    public String getNamespace() {
        return UTIL_Namespace.getNamespace();
    }

    /***
    * @description Enablement service
    */
    @TestVisible
    private static RD2_EnablementService service {
        get {
            if (service == null) {
                service = new RD2_EnablementService();
            }
            return service;
        }
        set;
    }

    /***
    * @description Loads the enablement state so the current completed and pending options can be displayed
    * @return String JSON representation of the current EnablementState
    */
    @AuraEnabled(cacheable=false)
    public static String loadState() {
        return JSON.serialize(getEnablementState());
    }

    /***
    * @description Retrieves the current enablement state 
    * @return EnablementState
    */
    @TestVisible
    private static EnablementState getEnablementState() {
        EnablementState state = new EnablementState();

        try {
            String jsonState = UTIL_CustomSettingsFacade.getRecurringDonationsSettings().RecurringDonations2EnablementState__c;
            
            if (String.isNotBlank(jsonState)) {
                state = (EnablementState) JSON.deserialize(jsonState, EnablementState.class);
            }
            
            state.isReady = service.isRecurringDonations2Ready();
            state.isEnabled = service.isRecurringDonations2Enabled();

            if (String.isBlank(jsonState)) {
                state.isConfirmed = false;
                state.isMetaDeployLaunched = false;
                state.isMetaDeployConfirmed = false;
                state.isMigrationRun = false;
            } else {
                state.isMetaDeployLaunched = state.isMetaDeployLaunched && state.isEnabled;
                state.isMetaDeployConfirmed = state.isMetaDeployConfirmed && state.isMetaDeployLaunched && isMetaDeployInstalled();
                state.isMigrationRun = state.isMigrationRun && state.isMetaDeployConfirmed;
            }

        } catch (Exception e) {
            throwAuraHandledException(e.getMessage());
        }

        return state;
    }

    /***
    * @description Tracks the enablement confirmation user action
    * @return void
    */
    @AuraEnabled
    public static void confirmEnablement() {
        EnablementState state = getEnablementState();
        state.isConfirmed = true;

        saveEnablementState(state);
    }

    /***
    * @description Tracks the enhanced Recurring Donation enablement user action
    * @return void
    */
    @AuraEnabled
    public static void enableEnhancement() {
        try {
            STG_Panel.stgService.stgRD.isRecurringDonations2Enabled__c = true;

            if (!Test.isRunningTest()) {
                upsert STG_Panel.stgService.stgRD;
            }

        } catch (Exception e) {
            throwAuraHandledException(e.getMessage());
        }
    }

    /***
    * @description Tracks the MetaDeploy link click user action
    * @return void
    */
    @AuraEnabled
    public static void launchMetaDeploy() {
        EnablementState state = getEnablementState();
        state.isMetaDeployLaunched = true;

        saveEnablementState(state);
    }

    /***
    * @description Tracks the MetaDeploy install confirmation user action
    * @return void
    */
    @AuraEnabled
    public static void confirmMetaDeploy() {        
        if (!isMetaDeployInstalled()) {
            throwAuraHandledException(System.Label.RD2_EnablementMetaDeployConfirmError);
        }

        EnablementState state = getEnablementState();
        state.isMetaDeployConfirmed = true;

        saveEnablementState(state);
    }

    /***
    * @description Checks if MetaDeploy has been installed
    * @return Boolean
    */
    private static Boolean isMetaDeployInstalled() {
        List<SelectOption> lastDayOfMonthOptions = UTIL_Describe.getSelectOptions(
            String.valueOf(npe03__Recurring_Donation__c.SObjectType), 
            SObjectType.npe03__Recurring_Donation__c.fields.Day_Of_Month__c.Name
        );

        for (SelectOption option : lastDayOfMonthOptions) {
            if (option.getValue() == dayOfMonthPicklistValue) {
                return true;
            }
        }
        return false;
    }

    /***
    * @description Saves the current enablement state
    * @param state Enablement state
    * @return void
    */
    private static void saveEnablementState(EnablementState state) {  
        try {
            //do not save variables obsolete in the saved enablement state   
            state.isReady = null;
            state.isEnabled = null;   

            //save the state
            STG_Panel.stgService.stgRD.RecurringDonations2EnablementState__c = JSON.serialize(state);
            
            if (!Test.isRunningTest()) {
                upsert STG_Panel.stgService.stgRD;
            }

        } catch (Exception e) {
            throwAuraHandledException(e.getMessage());
        }
    }

    /***
    * @description Throws AuraHandledException
    * @param errMessage
    * @return void
    */
    private static void throwAuraHandledException(String errMessage) {
        AuraHandledException e = new AuraHandledException(errMessage);
        e.setMessage(errMessage);
        throw e;
    }

    /***
    * @description Represents enhanced Recurring Donation options and status
    */
    public class EnablementState {
        public Boolean isReady = false;
        public Boolean isConfirmed = false;
        public Boolean isEnabled = false;
        public Boolean isMetaDeployLaunched = false;
        public Boolean isMetaDeployConfirmed = false;
        public Boolean isMigrationRun = false;
    }

}