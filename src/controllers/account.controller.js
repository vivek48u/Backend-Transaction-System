const accountModel = require('../models/account.model')
const crypto = require("crypto");
const emailServices = require('../services/email.services')   // apna real path

async function generateAccountNumber() {
    while (true) {
        const number = String(crypto.randomInt(10000000, 100000000)); // 8 digits
        const exists = await accountModel.exists({ accountNumber: number });
        if (!exists) return number;
    }

}

async function createAccountController(req, res) {
    try {
        const { isPrimary } = req.body;   // true or false from frontend

        const count = await accountModel.countDocuments({ user: req.user._id });

        // first account is always primary, otherwise follow the user's choice
        const makePrimary = count === 0 ? true : Boolean(isPrimary);

        if (makePrimary) {
            await accountModel.updateMany(
                { user: req.user._id },
                { isPrimary: false }
            );
        }

        const account = await accountModel.create({
            user: req.user._id,
            isPrimary: makePrimary,
            accountNumber: await generateAccountNumber(),
        });

        await emailServices.sendAccountCreatedEmail(
            req.user.email,
            req.user.name,
            account.accountNumber,
            account.isPrimary
        )

        res.status(201).json({ account });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
}

async function getUserAccountController(req, res) {
    const accounts = await accountModel.find({ user: req.user._id })

    res.status(200).json({
        accounts
    })
}

async function getAccountBalanceController(req, res) {
    try {
        const account = await accountModel.findOne({
            user: req.user._id,
            isPrimary: true,
        });

        if (!account) {
            return res.status(404).json({ message: "Primary account not found" });
        }

        const balance = await account.getBalance();   // or account.balance
        res.status(200).json({ balance });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
}

async function setPrimary(req, res) {
    try {
        // check the account belongs to this user first
        const account = await accountModel.findOne({
            _id: req.params.accountId,
            user: req.user._id,
        });

        if (!account) {
            return res.status(404).json({ message: "Account not found" });
        }

        // remove primary from all accounts of this user
        await accountModel.updateMany({ user: req.user._id }, { isPrimary: false });

        // make this one primary
        account.isPrimary = true;
        await account.save();

        res.status(200).json({ message: "Primary account updated", account });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
}



module.exports = { createAccountController, getUserAccountController, getAccountBalanceController, setPrimary }