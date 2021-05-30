import initModel from './Model'

const MSG = {
	HTTP_SUCCESS_ITEM: "HTTP_SUCCESS_ITEM",
	HTTP_SUCCESS_BULK_UPLOAD_PLUS: "HTTP_SUCCESS_BULK_UPLOAD_PLUS",
	HTTP_ERROR: "HTTP_ERROR",
	CLEAR_ERROR: "CLEAR_ERROR",
	DELETE_LOT: "DELETE_LOT",
	SAVE: "SAVE",
	UPLOAD: "UPLOAD",
	BULK_UPLOAD: "BULK_UPLOAD",
	BULK_UPLOAD_PLUS: "BULK_UPLOAD_PLUS",
	SHOW_OWNER_PROPERTY: "SHOW_OWNER_PROPERTY",
	LOCAL_STORAGE: "LOCAL_STORAGE",
	SHOW_MISSING_PROPERTY: "SHOW_MISSING_PROPERTY",
	TRASH: "TRASH",
}

function roadItemUrl() {
	return `${import.meta.env.VITE_HTTP}/lots`
}
// submit button on road name.
// make changes to model and wait for response form server.
export const clearError = { type: MSG.CLEAR_ERROR }
export const getLocalStorage = { type: MSG.LOCAL_STORAGE }
export const showMissingProperty = { type: MSG.SHOW_MISSING_PROPERTY }
export const clearStorage = { type: MSG.TRASH }

export function showOwnerProperty(landId) { return {type: MSG.SHOW_OWNER_PROPERTY, landId} }
export function deleteLot(id) {return {type: MSG.DELETE_LOT, id,}}
export function uploadStorage(data, error=null) {return {type: MSG.UPLOAD, data, error}}
export function bulkUpload(data, name='',error=null) {return {type: MSG.BULK_UPLOAD, data, name, error}}
export function bulkUploadPlus(data, error=null) {return {type: MSG.BULK_UPLOAD_PLUS, data, error}}
// response make changes to data.
const httpSuccessItemMsg = (response) => ({
	type: MSG.HTTP_SUCCESS_ITEM,
	response
})
const httpSuccessBulkUploadPlusMsg = (response) => ({
	type: MSG.HTTP_SUCCESS_BULK_UPLOAD_PLUS,
	response
})
const httpErrorMsg = (error) => ({ type: MSG.HTTP_ERROR, error})

function findMissingLandIds(owners) {
	let missingLandIds = []
	// loop through owners array 
	for (const owner of owners) {
	  // filter ownersProperty with 'empty' territory values.
	  missingLandIds.push(...owner.ownerProperty.filter(prop => prop.territory === 'empty')) 
  	}
	 // loop thorugh array and extract propertyId of all empty territory's.
	return missingLandIds.map(prop => prop.propertyId) 
}

function newFeaturesRepair(modelTemp) {
	// find missing  properties, insert into model.
	
	const newModel = modelTemp.showMissingProperty 
	? modelTemp 
	: { ...modelTemp, showMissingProperty:false }
	// will return empty array if no properties listed.
	const missingProperty = findMissingLandIds(newModel.owners)
	missingProperty.sort()
	newModel.missingProperty = missingProperty
	
	// extract owners array and sort. The owners array is inside an object.
	const {owners} = newModel
	
	// fix missing improvements and lands
	const newOwners = owners.map(owner => {
		owner.improvements = owner.improvements ? owner.improvements : [{improvement: '', stateCode: '', sqft: '', value: ''}]

		owner.lands = owner.lands ? owner.lands : [{landType: '', acres: '', sqft: '', marketValue: '', prodValue: ''}]
		return owner
	})

	newModel.owners = newOwners

	return newModel	
} // end newFeatureRepair


// update function start
function update(msg, model) {
	switch (msg.type) {
		case MSG.UPLOAD: {
			const { data } = msg
			// if older datafile, is missing missingProperty array.  Needed on bulk upload as well.
			const newModel = JSON.parse(data)

			// fix addon features
			// const newModel = newFeaturesRepair(modelTemp)			

			localStorage.clear()
			localStorage.setItem('model', JSON.stringify(newModel))
			return newModel
		}
		case MSG.BULK_UPLOAD: {
			const { data, name } = msg
			localStorage.clear()

			// transform file into array of id's.
			const bulkIdArray = data
				.replace(/\n|\r\n|\r/gi, '') // remove newlines
				.split(',') // convert to array.
				.filter(id => id !== '') // remove blank items

			var newBulkIdArray = []
				try {
					// check if JSON values.
					newBulkIdArray = bulkIdArray.map(id => JSON.parse(id) ? JSON.parse(id) : id)
				} catch(e) {
					// if catch, means was not JSON format, so just add it to variable.
					newBulkIdArray = bulkIdArray
				}
			
			if (Array.isArray(newBulkIdArray)) {			
				// clear any existing data from model.
				const newModel = {
					...initModel,
					key: false,
					waiting: true,
					territory: name.replace(/\.\w+$/i, ''),
					bulkUpload: true,
					// bulkIdArray,
				}
				return [
					newModel,
					{
						request: { 
							url: roadItemUrl(),
							body: JSON.stringify({ landIds: newBulkIdArray, territory: name.replace(/\.\w+$/i, ''), }), //already JSON.stringify
							method: 'post',
							headers: {'Content-Type': 'application/json;charset=utf-8'},
						},
						successMsg: httpSuccessItemMsg,
						errorMsg: httpErrorMsg
					}
				]
			} else {
				return {...model, error: 'There was a problem with file. Please upload again.'}
			}
		}
		case MSG.BULK_UPLOAD_PLUS: {
			const { data } = msg
			localStorage.clear()

			// transform file into array of id's.
			const bulkIdArray = data
				.replace(/\n|\r\n|\r/gi, '') // remove newlines
				.split(',') // convert to array.
				.filter(id => id !== '') // remove blank items

			var newBulkIdArray = []
				try {
					// check if JSON values.
					newBulkIdArray = bulkIdArray.map(id => JSON.parse(id) ? JSON.parse(id) : id)
				} catch(e) {
					// if catch, means was not JSON format, so just add it to variable.
					newBulkIdArray = bulkIdArray
				}
			
			if (Array.isArray(newBulkIdArray)) {			
				// clear any existing data from model.
				const newModel = {
					...model,
					waiting: true,
				}
				return [
					newModel,
					{
						request: { 
							url: roadItemUrl(),
							body: JSON.stringify({ landIds: newBulkIdArray, territory: model.territory }), //already JSON.stringify
							method: 'post',
							headers: {'Content-Type': 'application/json;charset=utf-8'},
						},
						successMsg: httpSuccessBulkUploadPlusMsg,
						errorMsg: httpErrorMsg
					}
				]
			} else {
				return {...model, error: 'There was a problem with Plus file. Please upload again.'}
			}
		}
		case MSG.HTTP_SUCCESS_ITEM: {
			// return of bulk upload if successfull.

			const { response: owners } = msg // array of owner objects. -each object is complete model.
			// const ownersArr = response // array of owners
			// const owners = [ ...model.owners, ...ownersArr ]

			const missingProperty = findMissingLandIds(owners)
			missingProperty.sort()
			model.missingProperty = missingProperty

			owners.sort((a, b) => {
				a = a.name
				b = b.name
				if (a < b) return -1
				if (b < a) return 1
				return 0
				})
			const newModel = { ...model, waiting: false, owners }
			localStorage.clear()
			localStorage.setItem('model', JSON.stringify(newModel))
			return newModel
		}
		case MSG.HTTP_SUCCESS_BULK_UPLOAD_PLUS: {
			// return of bulk upload if successfull.

			const { response: owners } = msg // array of owner objects. -each object is complete model.
			// const ownersArr = response // array of owners
			// const owners = [ ...model.owners, ...ownersArr ]

			const newOwners = [...model.owners, ...owners ]
			console.log('newOwners', newOwners);
			// const missingProperty = findMissingLandIds(newOwners)
			const missingProperty = [ ...findMissingLandIds(owners), ...model.missingProperty]
			missingProperty.sort()
			model.missingProperty = missingProperty

			newOwners.sort((a, b) => {
				a = a.name
				b = b.name
				if (a < b) return -1
				if (b < a) return 1
				return 0
				})
			const newModel = { ...model, waiting: false, owners: newOwners }
			localStorage.clear()
			localStorage.setItem('model', JSON.stringify(newModel))
			return newModel
		}
		case MSG.HTTP_ERROR: {
			const { error } = msg
			return {...model, waiting: false, error}
		}
		case MSG.CLEAR_ERROR: {
			return {...model, error: null}
		}
		case MSG.DELETE_LOT: {
			const id = msg.id
			// remove card from owners, remove land from each ownerProperty
			const owners = model.owners.reduce( (acc, owner) => {
				const ownerProperty = owner.ownerProperty.filter(prop => prop.propertyId !== id)	
				const newOwner = { ...owner, ownerProperty }
				if (id !== newOwner.landId) {
					return [...acc, newOwner]
				}
				return acc
			}, [])

			const newModel = {...model, owners }
			localStorage.clear()
			localStorage.setItem('model', JSON.stringify(newModel))			
			return newModel
		}
		case MSG.SHOW_MISSING_PROPERTY: {
			const showMissingProperty = model.showMissingProperty ? false : true
			const newModel = {...model, showMissingProperty}
			localStorage.clear()
			localStorage.setItem('model', JSON.stringify(newModel))

			return newModel
		}
		case MSG.TRASH: {
			localStorage.clear()
			return initModel
		}
		case MSG.SHOW_OWNER_PROPERTY: {
			// show/hide owner properties button clicked.
			const { landId } = msg
			// extract owner from owners
			const owners = model.owners.filter(owner => owner.landId !== landId)
			const [owner] = model.owners.filter(owner => owner.landId === landId)
			// find index of owner id
			const i = model.owners.findIndex(owner => owner.landId === landId)
			
			const showOwnerProperty = owner.showOwnerProperty ? false : true
			const newOwner = {...owner, showOwnerProperty}
			// insert back into array.
			const junk = owners.splice(i, 0, newOwner) // destructive
			const newModel = {
				...model,
				owners,
			}
			localStorage.clear()
			localStorage.setItem('model', JSON.stringify(newModel))
			return newModel
		}
		case MSG.LOCAL_STORAGE: {
			if (!!localStorage.getItem('model')) {
				const newModel = JSON.parse(localStorage.getItem('model')) 
				
				// fix missing features
				// const newModel = newFeaturesRepair(modelTemp)			

				// localStorage.clear()
				// localStorage.setItem('model', JSON.stringify(newModel))
	
				return newModel
			}
			return model
		}
	}
	return model
}

export default update
