const mongoose=require('mongoose')

async function connectDB(){
    await mongoose.connect("mongodb+srv://Vivek:1234@backend.180z6qo.mongodb.net/BankProject")
    .then(()=>{
       console.log("Database Connected Succefully")
    })
    .catch(err =>{
        console.log("Failed To Connect Database")
        process.exit(1)
    })
    
}

module.exports=connectDB;