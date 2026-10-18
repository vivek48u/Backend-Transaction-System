const mongoose=require('mongoose')

const tokenBalckListSchema = new mongoose.Schema({
    token:{
        type:String,
        required:[true,'token is required to blacklist'],
        unique:[true,'token is already blacklisted']
    },
},{timestamps:true})

tokenBalckListSchema.index( {crearedAt:1 },{
    expireAfterSeconds:60*60*24*3
})

const blackListModel=mongoose.model('tokenBlacklist',tokenBalckListSchema)

module.exports=blackListModel

