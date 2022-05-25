const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// (process.env.STRIPE_SECRET_KEY)
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rhmnp.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    const toolsCollection = client.db('Tools').collection('tools');
    const purchaseCollection = client.db('Purchase').collection('purchase');
    const paymentCollection = client.db('Purchase').collection('payment');
    const myprofileCollection = client.db('Tools').collection('myprofile');

    console.log('Database connected successfully');

    app.get('/tools', async (req, res) => {
      const query = {};
      const cursor = toolsCollection.find(query);
      const tools = await cursor.toArray();

      res.send(tools);
    });

    app.get('/tools/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const tool = await toolsCollection.findOne(query);
      res.send(tool);
    });

    app.put('/tools/:id', async (req, res) => {
      const id = req.params.id;
      const quantity = req.query.minimumquanyity;
      const email = req.query.email;
      const price = req.query.price;
      const query = { _id: ObjectId(id) };

      const tool = await toolsCollection.findOne(query);
      //console.log(tool);
      
      const updateDoc = {
        $set: {
          availableQuantity: tool.availableQuantity - quantity,
          
        },
      };
      const tool1 = await toolsCollection.updateOne(query, updateDoc);
      const tool2 = await toolsCollection.findOne(query);
      console.log("tools2",tool2);
      //const result = await purchaseCollection.updateOne(query, updateDoc);
      //console.log("result",result);
      res.send(tool2);
    });

    app.put('/purchase/:id', async(req, res) => {
      const id = req.params.id;
      console.log(id);
      const price=req.query.price
      const quantity=req.query.quantity
      const email=req.query.email

      const query = { _id: ObjectId(id) };

      const tool = await toolsCollection.findOne(query);
      tool.totalPrice=price*quantity
      const options = { upsert: true };
      const updateDoc = {
       
          price:tool.price,
          email:email,
          totalPrice:price*quantity,

          totalOrder:quantity,
          name:tool.name,
          description:tool.description,
          
        
      };
     
      //const totalPrice=price*quantity
      console.log("hello",tool)
      const result = await purchaseCollection.insertOne(updateDoc)
     const ress=await purchaseCollection.findOne(query)
      console.log("helloooo",ress)
      res.send(result)


    });



    app.post('/create-payment-intent', async(req, res) =>{
      const service = req.body;
      const totalPrice = service.totalPrice;
      const amount = totalPrice*100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount : amount,
        currency: 'usd',
        payment_method_types:['card']
      });
      res.send({clientSecret: paymentIntent.client_secret})
    });
    app.get('/purchase', async (req, res) => {
      const email = req.query.email;
      console.log(email);
      const query = { email: email };
      const orders = await purchaseCollection.find(query).toArray();
      console.log(orders);
      res.send(orders);
    });
    app.get('/purchase/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const booking = await purchaseCollection.findOne(query);
      res.send(booking);
    });

      app.patch('/purchase/:id', async(req, res) =>{
      const id  = req.params.id;
      console.log(id)
      const payment = req.body;
      console.log(payment)
      const filter = {_id: ObjectId(id)};
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId
        }
      }

      const result = await paymentCollection.insertOne(payment);
      console.log(result)
      const updatedBooking = await purchaseCollection.updateOne(filter, updatedDoc);
      res.send(updatedBooking);
    })




    app.post('/myprofile',async(req,res)=>{
      const data=req.body
      const result = await myprofileCollection.insertOne(data);
      res.send(result)
    })
  } finally {
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello From Doctor Uncle!');
});

app.listen(port, () => {
  console.log(`Doctors App listening on port ${port}`);
});
