const userModel = require('../models/user.model')
const jwt = require('jsonwebtoken')
const tokenBlackListModel=require('../models/balcklist.model')

async function authMiddleware(req, res, next) {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1]

    if (!token) {
        return res.status(401).json({
            message: 'unauthorized access, token is missing'
        })
    }

    const isBlacklisted=await tokenBlackListModel.findOne({
        token
    })

    if(isBlacklisted){
        return res.status(401).json({
            message:'Unauthorized access, token is invalid'
        })
    }
    try {
        const decoded = jwt.verify(token, process.env.JWTSECRET_KEY)

        const user = await userModel.findById(decoded.userId)

        req.user = user

        return next()
    } catch (err) {
        return res.status(401).json({
            message: 'unauthorized access, token is invalid '
        })
    }

}

async function authSystemUserMiddleware(req, res, next) {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1]

    if (!token) {
        return res.status(401).json({
            message: 'unauthorized access , token is missing'
        })
    }

     const isBlacklisted=await tokenBlackListModel.findOne({
        token
    })

    if(isBlacklisted){
        return res.status(401).json({
            message:'Unauthorized access, token is invalid'
        })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWTSECRET_KEY)

        console.log("Decoded userId:", decoded.userId);
        const user = await userModel.findById(decoded.userId).select('+systemUser')

        console.log("User found:", user);

        if (!user) {
            return res.status(404).json({
                message: "User not found in database"
            });
        }

        if (!user.systemUser) {
            return res.status(403).json({
                message: "Forbidden access, not a system user"
            })
        }


        req.user = user

        return next()

    } catch (err) {
        console.log("Auth middleware error:", err);

        return res.status(401).json({
            message: "Unauthorized access",
            error: err.message
        })
    }

}

module.exports = { authMiddleware, authSystemUserMiddleware }