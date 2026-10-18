const transactionModel =require('../models/transaction.model')
const ledgerModel=require('../models/ledger.model')
const accountModel=require('../models/account.model')
const emailServices=require('../services/email.services')
const mongoose=require('mongoose')

async function createTransaction(req,res){

// 1.Validate request
    const {fromAccount,toAccount,amount,idempotencyKey}=req.body

     if(!fromAccount || !toAccount || !amount || !idempotencyKey){
        return res.status(400).json({
            message:'fromAccount,toAccount,amount and idempotencyKey is required'
        })
     }

     const fromUserAccount=await accountModel.findOne({
     _id:fromAccount,
     })

     const toUserAccount=await accountModel.findOne({
        _id:toAccount
     })

     if(!fromUserAccount || !toUserAccount){
        return res.status(400).json({
            message:'invalid fromAccount or toAccount'
        })
     }

//2.validate idempotemncy key

     const isTarnsactionAlredyExits=await transactionModel.findOne({
        idempotencyKey:idempotencyKey
     })

     if(isTarnsactionAlredyExits){
        if(isTarnsactionAlredyExits.status=='completed'){
            return res.status(200).json({
                message:'Transaction Already Proceed ',
                transaction:isTarnsactionAlredyExits
            })
        }
        if(isTarnsactionAlredyExits.status=='pending'){
            return res.status(200).json({
                message:'Transaction is still processing'
            })
        }
        if(isTarnsactionAlredyExits.status=='failed'){
            return res.status(402).json({
                message:'Transaction Processing is failed, Try again'
            })
        }
        if(isTarnsactionAlredyExits.status=='reversed'){
            return res.status(500).json({
                message:'transaction was reversed , please retry'
            })
        }
     }
//3.Check Account Status

if(fromUserAccount.status !== 'Active' || toUserAccount.status !=='Active' ){
    return res.status(400).json({
        message:'Both fromAccount and toAccount must be Active to process transaction'
    })
}

//4.derive sender balance from ledger

const balance=await fromUserAccount.getBalance()

if(balance<amount){
   return res.status(400).json({
      message:`insufficiant balance in fromAccount, current Balance is ${balance},requested amount is ${amount}`
    })
}

//5.Create Transaction
const session=await mongoose.startSession()
session.startTransaction()

const transaction=new transactionModel({
    fromAccount,
    toAccount,
    amount,
    idempotencyKey,
    status:'pending'
})

const debitLedgerEntry=await ledgerModel.create([{
    account:fromAccount,
    amount:amount,
    transaction:transaction._id,
    type:'debit'
}],{session})

const cerditLedgerEntry=await ledgerModel.create([{
    account:toAccount,
    amount:amount,
    transaction:transaction._id,
    type:'credit'
}],{session})

transaction.status='completed'
await transaction.save({session})

await session.commitTransaction()
session.endSession()


//Send Email Notification

await emailServices.sendTransactionEmail(req.user.email,req.user.name,amount,toAccount)

return res.status(200).json({
    message:'Transaction Completed Successfully',
    transaction
})
  
}

async function createIntialFundsTransaction(req,res){
    const {toAccount,amount,idempotencyKey}=req.body

    if(!toAccount || !amount || !idempotencyKey){
        return res.status(400).json({
            message:'toAccount, amount and idempotency is required'
        })
    }

    const toUserAccount=await accountModel.findOne({
        _id:toAccount,
    })

    if(!toUserAccount){
        return res.status(400).json({
            message:'Invalid toAccount'
        })
    }

    const fromUserAccount=await accountModel.findOne({
        user:req.user._id
    })

    if(!fromUserAccount){
        return res.status(401).json({
            message:"System User Account Not Found"
        })
    }

    const session=await mongoose.startSession()
    session.startTransaction()

    const transaction=new transactionModel({
        fromAccount:fromUserAccount._id,
        toAccount,
        amount,
        idempotencyKey,
        status:"pending"
    })

    const debitLederEntry=await ledgerModel.create([{
        account:fromUserAccount._id,
        amount:amount,
        transaction:transaction._id,
        type:"debit",
    }],{session})

    await(()=>{
       return new Promise((resolve)=>setTimeout(resolve,15*1000))
    })()

    const creditLederEntry=await ledgerModel.create([{
        account:toAccount,
        amount:amount,
        transaction:transaction._id,
        type:"credit",
    }],{session})

    transaction.status="completed"
    await transaction.save({session})

    await session.commitTransaction()
    session.endSession()

    return res.status(201).json({
        message:"Intially funds transaction complted succesully",
        transaction:transaction
    })
}

module.exports={createTransaction,createIntialFundsTransaction}