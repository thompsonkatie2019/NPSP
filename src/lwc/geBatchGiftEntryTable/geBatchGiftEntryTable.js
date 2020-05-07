import {LightningElement, api, track, wire} from 'lwc';
import getDataImportModel
    from '@salesforce/apex/BGE_DataImportBatchEntry_CTRL.getDataImportModel';
import getDataImportRows
    from '@salesforce/apex/BGE_DataImportBatchEntry_CTRL.getDataImportRows';
import GeFormService from 'c/geFormService';
import STATUS_FIELD from '@salesforce/schema/DataImport__c.Status__c';
import FAILURE_INFORMATION_FIELD
    from '@salesforce/schema/DataImport__c.FailureInformation__c';
import {deleteRecord, updateRecord} from 'lightning/uiRecordApi';
import {handleError} from 'c/utilTemplateBuilder';
import runBatchDryRun from '@salesforce/apex/BGE_DataImportBatchEntry_CTRL.runBatchDryRun';
import geDonorColumnLabel from '@salesforce/label/c.geDonorColumnLabel';
import geDonationColumnLabel from '@salesforce/label/c.geDonationColumnLabel';
import bgeActionDelete from '@salesforce/label/c.bgeActionDelete';
import commonOpen from '@salesforce/label/c.commonOpen';

import BATCH_ID_FIELD from '@salesforce/schema/DataImportBatch__c.Id';
import BATCH_TABLE_HEADERS from '@salesforce/schema/DataImportBatch__c.Batch_Table_Headers__c';
import { deepClone } from 'c/utilCommon';

const EVENT_TOGGLE_MODAL = 'togglemodal';
const REQUIRED_TABLE_HEADERS = [
    STATUS_FIELD.fieldApiName,
    FAILURE_INFORMATION_FIELD.fieldApiName,
    'donorLink',
    'matchedRecordUrl',
];

export default class GeBatchGiftEntryTable extends LightningElement {
    @api batchId;
    @track ready = false;

    _batchLoaded = false;
    @track data = [];
    @track hasData;

    _columnsLoaded = false;
    @track columns = [];
    _columns = [
        {label: 'Status', fieldName: STATUS_FIELD.fieldApiName, type: 'text'},
        {label: 'Errors', fieldName: FAILURE_INFORMATION_FIELD.fieldApiName, type: 'text'},
        {
            label: geDonorColumnLabel, fieldName: 'donorLink', type: 'url',
            typeAttributes: {label: {fieldName: 'donorName'}}
        },
        {
            label: geDonationColumnLabel, fieldName: 'matchedRecordUrl', type: 'url',
            typeAttributes: {label: {fieldName: 'matchedRecordLabel'}}
        }
    ];
    _actionsColumn = {
        type: 'action',
        typeAttributes: {
            rowActions: [
                {label: commonOpen, name: 'open'},
                {label: bgeActionDelete, name: 'delete'}
            ],
            menuAlignment: 'auto'
        }
    };

    _totalCountOfGifts;
    _totalAmountOfGifts;
    @track isLoaded = true;


    _selectedTableHeaders = [];
    columnsBySourceFieldApiName = {};
    
    tableHeaderOptions = [];
    dedicatedListenerEventName = 'geBatchGiftEntryTableEvent';

    /*******************************************************************************
    * @description Public method for receiving modal related events from geListView.
    *
    * @param {object} modalData: Event object containing the action and modal payload.
    * component chain: utilDualListbox -> geListView -> here.
    */
    @api
    notify(event) {
        console.log('made it back to the table: ', deepClone(event));
        console.log('this.map: ', deepClone(this.columnsBySourceFieldApiName));
        this._selectedTableHeaders = [];
        let userDefinedColumns = [];
        for (let i = 0; i < event.payload.values.length; i++) {
            const selectedColumn = this.columnsBySourceFieldApiName[event.payload.values[i]];
            this._selectedTableHeaders.push(event.payload.values[i]);
        }

        this.initColumns([]);
        this.saveBatchTableHeaders();
    }

    saveBatchTableHeaders() {
        console.log('*** saveBatchTableHeaders');
        let fields = {};
        fields[BATCH_ID_FIELD.fieldApiName] = this.batchId;
        fields[BATCH_TABLE_HEADERS.fieldApiName] = JSON.stringify(this._selectedTableHeaders);
        console.log(fields);
        const dataImportBatch = { fields };

        updateRecord(dataImportBatch)
        .then((data) => {
            console.log('success save: ', data);
        })
        .catch((error) => {
            console.error(error);
        })
    }

    /*******************************************************************************
    * @description Method handles dispatches a custom event to the parent component
    * to toggle a modal.
    */
    toggleModal(event) {
        console.log('toggle table header modal...');
        event.stopPropagation();
        const detail = {
            componentProperties: {
                cssClass: 'slds-m-bottom_medium slds-p-horizontal_small',
                name: this.listName,
                options: this.tableHeaderOptions,
                requiredOptions: REQUIRED_TABLE_HEADERS,
                values: this.columns.map((column) => column.fieldName),
                sourceLabel: 'Available Fields',
                selectedLabel: 'Visible Fields',
                showModalFooter: true,
                dedicatedListenerEventName: this.dedicatedListenerEventName,
                targetComponentName: 'ge-batch-gift-entry-table',
            },
            modalProperties: {
                componentName: 'utilDualListbox',
                header: 'Select Fields to Display',
                showCloseButton: true,
            }
        };

        this.dispatchEvent(new CustomEvent(EVENT_TOGGLE_MODAL, { detail: detail }));
    }

    /*******************************************************************************
    * @description Method builds a list of options used to populate the available
    * fields in the utilDualListbox component. utilDualListbox is used in the list
    * settings modal.
    *
    * @param {list} fields: List of fields from the object describe info.
    */
    buildFieldsToDisplayOptions(fields) {
        let options = [];

        fields.forEach(field => {
            if (!field.fieldName) return;
            options.push({
                label: field.label,
                value: field.fieldName
            });
        });
        console.log('options: ', options);
        return options;
    }

    connectedCallback() {
        if (this.batchId) {
            this.loadBatch();
        }
    }

    setReady() {
        this.ready = this._columnsLoaded && this._batchLoaded;
    }

    loadBatch() {
        getDataImportModel({batchId: this.batchId})
            .then(
                response => {
                    const dataImportModel = JSON.parse(response);
                    this._totalCountOfGifts = dataImportModel.totalCountOfRows;
                    this._totalAmountOfGifts = dataImportModel.totalRowAmount;
                    dataImportModel.dataImportRows.forEach(row => {
                            this.data.push(
                                Object.assign(row, row.record));
                        }
                    );
                    console.log('dataImportModel.batchTableHeaders: ', dataImportModel.batchTableHeaders);
                    this._selectedTableHeaders = JSON.parse(dataImportModel.batchTableHeaders);
                    console.log('this._selectedTableHeaders: ', this._selectedTableHeaders);
                    this.data = [...this.data];
                    this.hasData = this.data.length > 0 ? true : false;
                    this.batchLoaded();
                    console.log(deepClone(this.data));
                }
            )
            .catch(
                error => {
                    handleError(error);
                }
            );
    }

    batchLoaded() {
        this._batchLoaded = true;
        this.setReady();
    }

    @api
    handleSectionsRetrieved(sections) {
        console.log('*** handleSectionsRetrieved');
        this.initColumns(this.buildColumns(sections));
    }

    initColumns(userDefinedColumns) {
        console.log('*** initColumns');
        this.columns = [
            ...this._columns,
            ...userDefinedColumns,
            this._actionsColumn];

        this.tableHeaderOptions = this.buildFieldsToDisplayOptions(this.columns);

        if (this._selectedTableHeaders && this._selectedTableHeaders.length > 0) {
            console.log('HAVE SELECTED TABLE HEADERS: ');
            this.columns = [];
            this._selectedTableHeaders.forEach(header => {
                console.log(header);
                if (!header || !this.columnsBySourceFieldApiName[header]) return;
                this.columns.push(this.columnsBySourceFieldApiName[header]);
            });
            this.columns = [
                ...this.columns,
                this._actionsColumn];
        }

        this.columnsLoaded();
    }

    buildColumns(sections) {
        this.columnsBySourceFieldApiName[this._columns[0].fieldName] = this._columns[0];
        this.columnsBySourceFieldApiName[this._columns[1].fieldName] = this._columns[1];
        this.columnsBySourceFieldApiName[this._columns[2].fieldName] = this._columns[2];
        this.columnsBySourceFieldApiName[this._columns[3].fieldName] = this._columns[3];

        let columns = [];
        sections.forEach(
            section => {
                section.elements
                    .filter(e => e.elementType === 'field')
                    .forEach(
                    element => {
                        const column = {
                            label: element.label,
                            fieldName: GeFormService.getFieldMappingWrapper(
                                element.dataImportFieldMappingDevNames[0]
                            ).Source_Field_API_Name,
                            type: GeFormService.getInputTypeFromDataType(
                                element.dataType
                            ) === 'date' ? 'date-local' :
                                GeFormService.getInputTypeFromDataType(element.dataType)
                        };
                        columns.push(column);

                        this.columnsBySourceFieldApiName[column.fieldName] = column;
                    }
                );
            }
        );

        return columns;
    }

    columnsLoaded() {
        this._columnsLoaded = true;
        this.setReady();
    }

    @api
    upsertData(dataRow, idProperty) {
        const existingRowIndex = this.data.findIndex(row =>
            row[idProperty] === dataRow[idProperty]
        );

        if (existingRowIndex !== -1) {
            this.data.splice(existingRowIndex, 1, dataRow);
            this.data = [...this.data];
        } else {
            this.data = [dataRow, ...this.data];
            if (this.hasData == false) {
                this.hasData = true;
            }
        }
    }

    @api
    setTotalCount(value) {
        this._totalCountOfGifts = value;
    }

    @api
    setTotalAmount(value) {
        this._totalAmountOfGifts = value;
    }

    handleRowActions(event) {
        switch (event.detail.action.name) {
            case 'open':
                this.loadRow(event.detail.row);
                break;
            case 'delete':
                deleteRecord(event.detail.row.Id).then(() => {
                    this.deleteDIRow(event.detail.row);
                }).catch(error => {
                        handleError(error);
                    }
                );
                break;
        }
    }

    deleteDIRow(rowToDelete) {
        const isRowToDelete = row => row.Id == rowToDelete.Id;
        const index = this.data.findIndex(isRowToDelete);
        this.data.splice(index, 1);
        this.data = [...this.data];
    }

    loadMoreData(event) {
        event.target.isLoading = true;
        const disableInfiniteLoading = function () {
            this.enableInfiniteLoading = false;
        }.bind(event.target);

        const disableIsLoading = function () {
            this.isLoading = false;
        }.bind(event.target);

        getDataImportRows({batchId: this.batchId, offset: this.data.length})
            .then(rows => {
                rows.forEach(row => {
                        this.data.push(
                            Object.assign(row, row.record)
                        );
                    }
                );
                this.data = [...this.data];
                if (this.data.length >= this._totalCountOfGifts) {
                    disableInfiniteLoading();
                }
                disableIsLoading();
            })
            .catch(error => {
                handleError(error);
            });
    }

    @api
    runBatchDryRun(callback) {
        runBatchDryRun({
            batchId: this.batchId,
            numberOfRowsToReturn: this.data.length
        })
            .then(result => {
                const dataImportModel = JSON.parse(result);
                this.setTotalCount(dataImportModel.totalCountOfRows);
                this.setTotalCount(dataImportModel.totalRowAmount);
                dataImportModel.dataImportRows.forEach((row, idx) => {
                    this.upsertData(
                        Object.assign(row, row.record), 'Id');
                });
            })
            .catch(error => {
                handleError(error);
            })
            .finally(() => {
                callback();
            });
    }

    loadRow(row) {
        this.dispatchEvent(new CustomEvent('loaddata', {
            detail: row
        }));
    }
}