const express = require("express");
const app = express();
const admin = require("firebase-admin");
require("dotenv").config();
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;
//middleware
app.use(express.json());
app.use(cors());
app.get("/", (req, res) => {
  res.send("Running Jerin's Parlour Server");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.spl8q.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const verifyToken = async (req, res, next) => {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const idToken = req.headers?.authorization.split("Bearer ")[1];
    try {
      const decodedUser = await admin.auth().verifyIdToken(idToken);
      req.decodedEmail = decodedUser.email;
    } catch (error) {}
  }
  next();
};

const run = async () => {
  try {
    await client.connect();
    const database = client.db("parlourDb");
    const serviceCollection = database.collection("services");
    const usersCollection = database.collection("users");
    const bookingCollection = database.collection("bookings");
    const reviewCollection = database.collection("reviews");

    //getting all services
    app.get("/services", async (req, res) => {
      const result = await serviceCollection.find({}).toArray();
      res.send(result);
    });

    //post service
    app.post("/services", async (req, res) => {
      const service = req.body;
      const result = await serviceCollection.insertOne(service);
      res.send(result);
    });

    //getting single service by id
    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const result = await serviceCollection.findOne({ _id: ObjectId(id) });
      res.send(result);
    });

    //post users
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    //post booking details
    app.post("/booking", async (req, res) => {
      const service = req.body;
      const result = await bookingCollection.insertOne(service);
      res.send(result);
    });

    //post reviews
    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    //getting all review
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find({}).toArray();
      res.send(result);
    });

    //get booking by specific email query
    app.get("/booking", verifyToken, async (req, res) => {
      const email = req.query.email;
      const user = req.decodedEmail;
      if (user === email) {
        const result = await bookingCollection.find({ email: email }).toArray();
        res.send(result);
      } else {
        res.status(401).json({ message: "UnAuthorized" });
      }
    });

    //get booking by email id params
    app.get("/booking/:id", async (req, res) => {
      const email = req.params.id;
      const result = await bookingCollection.find({ email: email }).toArray();
      res.send(result);
    });

    //delete any booking
    app.delete("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const result = await bookingCollection.deleteOne({ _id: ObjectId(id) });
      res.send(result);
    });

    //get all booking details
    app.get("/bookings", async (req, res) => {
      const result = await bookingCollection.find({}).toArray();
      res.send(result);
    });

    //externally made for google sign in
    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    //update status
    app.put("/booking/:id", async (req, res) => {
      const newStatus = req.body.status;
      const filter = { _id: ObjectId(req.params.id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          status: newStatus,
        },
      };
      const result = await bookingCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    //get users
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find({}).toArray();
      res.send(result);
    });

    //get user by email
    app.get("/user/:id", async (req, res) => {
      const email = req.params.id;
      const result = await usersCollection.findOne({ email: email });
      res.send(result);
    });

    //getting admin
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email: email });
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.send({ admin: isAdmin });
    });

    //role play updating for admin
    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = await usersCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: user.email };
          const updateDoc = { $set: { role: "admin" } };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.send(result);
        } else {
          res
            .status(403)
            .send({ message: "You do not have access to make admin" });
        }
      }
    });
  } finally {
    // await client.close();
  }
};
run().catch(console.dir);

app.listen(port, () => {
  console.log("listening to the port", port);
});
