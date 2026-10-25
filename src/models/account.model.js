const mongoose = require('mongoose')
const ledgerModel = require('../models/ledger.model')

const accountSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: [true, 'Account must be associated with user'],
        index: true
    },
    status: {
        type: String,
        enum:{
        values: ['Active', 'Frozen', 'Closed'],
        message: 'Status must be either Active, Frozen or Closed',
        },
        default: 'Active',
    },
    currency: {
        type: String,
        required: [true, 'Currency is required for creating account'],
        default: 'INR'

    },
    isPrimary: { type: Boolean, default: false },
    
    accountNumber: { type: String, unique: true },

}, {
    timestamps: true
})

accountSchema.index({ user: 1, status: 1 })

accountSchema.methods.getBalance = async function () {  
    const balanceData = await ledgerModel.aggregate([
        { $match: { account: this._id } },
        {
            $group: {
                _id: null,
                totalDebit: {
                    $sum: {
                        $cond:[
                           { $eq:["$type", "debit"]},
                            "$amount",
                            0
                        ]
                    }
                },
                totalCredit:{
                    $sum:{
                        $cond:[
                            { $eq:["$type","credit"]},
                            "$amount",
                            0
                        ]
                    }
                }
            }        
        },
        {
                $project:{
                    _id:0,
                    balance:{$subtract:["$totalCredit","$totalDebit"]}
                }
            }
    ])

    if(balanceData.length===0){
        return 0
    }

    return balanceData[ 0 ].balance
}

const accountModel = mongoose.model('account', accountSchema)

module.exports = accountModel