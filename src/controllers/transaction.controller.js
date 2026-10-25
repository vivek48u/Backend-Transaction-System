const transactionModel = require('../models/transaction.model')
const ledgerModel = require('../models/ledger.model')
const accountModel = require('../models/account.model')
const emailServices = require('../services/email.services')
const mongoose = require('mongoose')

async function createTransaction(req, res) {
  // 1. Validate request
  const { fromAccount, toAccountNumber, amount, idempotencyKey } = req.body

  if (!fromAccount || !toAccountNumber || !amount || !idempotencyKey) {
    return res.status(400).json({
      message: 'fromAccount, toAccountNumber, amount and idempotencyKey is required'
    })
  }

  const numAmount = Number(amount)
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    return res.status(400).json({ message: 'Amount must be greater than 0' })
  }

  // sender: my own account (ownership check)
  const fromUserAccount = await accountModel.findOne({
    _id: fromAccount,
    user: req.user._id,
  })

  // receiver: found by the 8 digit account number
  const toUserAccount = await accountModel.findOne({ accountNumber: String(toAccountNumber) })
    .populate('user', 'name email')

  if (!fromUserAccount || !toUserAccount) {
    return res.status(400).json({ message: 'Invalid account number' })
  }

  if (fromUserAccount._id.equals(toUserAccount._id)) {
    return res.status(400).json({ message: 'Cannot send money to the same account' })
  }

  // 2. Idempotency check
  const existing = await transactionModel.findOne({ idempotencyKey })
  if (existing) {
    if (existing.status === 'completed') {
      return res.status(200).json({ message: 'Transaction Already Proceed', transaction: existing })
    }
    if (existing.status === 'pending') {
      return res.status(200).json({ message: 'Transaction is still processing' })
    }
    if (existing.status === 'failed') {
      return res.status(402).json({ message: 'Transaction Processing is failed, Try again' })
    }
    if (existing.status === 'reversed') {
      return res.status(500).json({ message: 'transaction was reversed, please retry' })
    }
  }

  // 3. Account status
  if (fromUserAccount.status !== 'Active' || toUserAccount.status !== 'Active') {
    return res.status(400).json({
      message: 'Both fromAccount and toAccount must be Active to process transaction'
    })
  }

  // 4. Balance
  const balance = await fromUserAccount.getBalance()
  if (balance < numAmount) {
    return res.status(400).json({
      message: `Insufficient balance. Current balance is ${balance}, requested amount is ${numAmount}`
    })
  }

  // 5. Create transaction
  const session = await mongoose.startSession()
  let transaction

  try {
    session.startTransaction()

    transaction = new transactionModel({
      fromAccount: fromUserAccount._id,
      toAccount: toUserAccount._id,
      amount: numAmount,
      idempotencyKey,
      status: 'pending'
    })

    await ledgerModel.create(
      [{ account: fromUserAccount._id, amount: numAmount, transaction: transaction._id, type: 'debit' }],
      { session }
    )

    await ledgerModel.create(
      [{ account: toUserAccount._id, amount: numAmount, transaction: transaction._id, type: 'credit' }],
      { session }
    )

    transaction.status = 'completed'
    await transaction.save({ session })

    await session.commitTransaction()
  } catch (err) {
    await session.abortTransaction()
    console.log(err)
    return res.status(500).json({ message: 'Transaction failed, please try again' })
  } finally {
    session.endSession()
  }

  // 6. Email (money is already sent, so email failure must not break the response)
  try {
    await emailServices.sendTransactionEmail(
      req.user.email,
      req.user.name,
      numAmount,
      toUserAccount.accountNumber,
      transaction._id
    )

    // receiver ko mail (apne hi do accounts ke beech transfer ho to skip)
    const sameUser = String(toUserAccount.user._id) === String(req.user._id)
    if (!sameUser) {
      await emailServices.sendMoneyReceivedEmail(
        toUserAccount.user.email,
        toUserAccount.user.name,
        numAmount,
        fromUserAccount.accountNumber,
        transaction._id
      )
    }
  } catch (err) {
    console.log('Email failed:', err.message)
  }

  return res.status(200).json({
    message: 'Transaction Completed Successfully',
    transaction
  })
}


async function createIntialFundsTransaction(req, res) {
  const { toAccountNumber, amount, idempotencyKey } = req.body

  if (!toAccountNumber || !amount || !idempotencyKey) {
    return res.status(400).json({
      message: 'toAccountNumber, amount and idempotencyKey is required'
    })
  }

  const numAmount = Number(amount)
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    return res.status(400).json({ message: 'Amount must be greater than 0' })
  }

  // receiver: found by 8 digit number
  const toUserAccount = await accountModel.findOne({ accountNumber: String(toAccountNumber) })
  .populate('user', 'name email')

  if (!toUserAccount) {
    return res.status(400).json({ message: 'Invalid account number' })
  }

  // sender: the system user's own account
  const fromUserAccount =
    (await accountModel.findOne({ user: req.user._id, isPrimary: true })) ||
    (await accountModel.findOne({ user: req.user._id }))

  if (!fromUserAccount) {
    return res.status(401).json({ message: 'System User Account Not Found' })
  }

  // idempotency check
  const existing = await transactionModel.findOne({ idempotencyKey })
  if (existing) {
    return res.status(200).json({
      message: 'Transaction already processed',
      transaction: existing
    })
  }

  const session = await mongoose.startSession()
  let transaction

  try {
    session.startTransaction()

    transaction = new transactionModel({
      fromAccount: fromUserAccount._id,
      toAccount: toUserAccount._id,
      amount: numAmount,
      idempotencyKey,
      status: 'pending'
    })

    await ledgerModel.create(
      [{ account: fromUserAccount._id, amount: numAmount, transaction: transaction._id, type: 'debit' }],
      { session }
    )

    await ledgerModel.create(
      [{ account: toUserAccount._id, amount: numAmount, transaction: transaction._id, type: 'credit' }],
      { session }
    )

    transaction.status = 'completed'
    await transaction.save({ session })

    await session.commitTransaction()
  } catch (err) {
    await session.abortTransaction()
    console.log(err)
    return res.status(500).json({ message: 'Failed to add funds, please try again' })
  } finally {
    session.endSession()
  }

  try {
    await emailServices.sendFundsAddedEmail(
      toUserAccount.user.email,
      toUserAccount.user.name,
      numAmount,
      toUserAccount.accountNumber,
      transaction._id
    )
  } catch (err) {
    console.log('Funds email failed:', err.message)
  }

  return res.status(201).json({
    message: 'Funds added successfully',
    transaction
  })
}

async function getLedgerEntries(req, res) {
  try {
    const { type } = req.query   // 'debit' ya 'credit'

    if (!['debit', 'credit'].includes(type)) {
      return res.status(400).json({ message: 'type must be debit or credit' })
    }

    const accounts = await accountModel.find({ user: req.user._id }).select('_id accountNumber')
    const ids = accounts.map((a) => a._id)

    const entries = await ledgerModel
      .find({ account: { $in: ids }, type })
      .populate('account', 'accountNumber')
      .sort({ createdAt: -1 })
      .limit(50)

    res.status(200).json({ entries })
  } catch (err) {
    console.log(err)
    res.status(500).json({ message: 'Server error' })
  }
}

async function getStats(req, res) {
  try {
    const accounts = await accountModel.find({ user: req.user._id }).select('_id')
    const accountIds = accounts.map((a) => a._id)

    const result = await ledgerModel.aggregate([
      { $match: { account: { $in: accountIds } } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } }
    ])

    let sent = 0
    let received = 0
    result.forEach((r) => {
      if (r._id === 'debit') sent = r.total
      if (r._id === 'credit') received = r.total
    })

    res.status(200).json({
      totalAccounts: accountIds.length,
      moneySent: sent,
      moneyReceived: received
    })
  } catch (err) {
    console.log(err)
    res.status(500).json({ message: 'Server error' })
  }
}

async function getHistory(req, res) {
  try {
    const myAccounts = await accountModel.find({ user: req.user._id }).select('_id')
    const myIds = myAccounts.map((a) => a._id)
    const mine = new Set(myIds.map(String))

    const transactions = await transactionModel
      .find({ $or: [{ fromAccount: { $in: myIds } }, { toAccount: { $in: myIds } }] })
      .populate({ path: 'fromAccount', select: 'accountNumber user', populate: { path: 'user', select: 'name' } })
      .populate({ path: 'toAccount', select: 'accountNumber user', populate: { path: 'user', select: 'name' } })
      .sort({ createdAt: -1 })
      .limit(100)

    const history = transactions.map((t) => {
      const fromMine = mine.has(String(t.fromAccount?._id))
      const toMine = mine.has(String(t.toAccount?._id))

      let direction = 'received'
      if (fromMine && toMine) direction = 'self'
      else if (fromMine) direction = 'sent'

      const other = direction === 'sent' ? t.toAccount : t.fromAccount

      return {
        _id: t._id,
        amount: t.amount,
        status: t.status,
        createdAt: t.createdAt,
        direction,
        otherAccountNumber: other?.accountNumber,
        otherName: other?.user?.name,
      }
    })

    res.status(200).json({ history })
  } catch (err) {
    console.log(err)
    res.status(500).json({ message: 'Server error' })
  }
}


module.exports = { createTransaction, createIntialFundsTransaction, getLedgerEntries, getStats, getHistory }