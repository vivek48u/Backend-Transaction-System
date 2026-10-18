const mongoose = require('mongoose')

const transactionSchema = new mongoose.Schema({
    fromAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'account',
        required: [true, 'transaction must be associated with a from account'],
        index: true,
    },
    toAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'account',
        required: [true, 'transaction must be associated with a to account'],
        index: true,
    },
    status:{
      type:String,
      enum:{
        values:['pending','completed','failed','reversed'],
        message:'status can be either pending,completed,failed and reversed'
      },
      default:'pending'
    },
    amount:{
        type:Number,
        required:[true,'amount is required from creating transaction'],
        min:[0,'transaction cannot be negative']
    },
    idempotencyKey:{
        type:String,
        required:[true,'idenpotency is required for creating transaction'],
        index:true,
        unique:true
    }

},{timestamps:true})

const transactionModel=mongoose.model('transaction',transactionSchema)

module.exports=transactionModel