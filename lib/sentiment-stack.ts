import cdk = require('@aws-cdk/cdk');
import apigateway = require("@aws-cdk/aws-apigateway");
import lambda = require("@aws-cdk/aws-lambda");
import ddb = require("@aws-cdk/aws-dynamodb");
import iam = require("@aws-cdk/aws-iam");
import s3 = require('@aws-cdk/aws-s3');
import s3deploy = require('@aws-cdk/aws-s3-deployment')

export class SentimentStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create Table for customer feedback
    const table = new ddb.Table(this, "UnicornCustomerFeedback", {
        partitionKey: { 
            name: "ID",
            type: ddb.AttributeType.String
        },
        sortKey: {
            name: "PostedTime",
            type: ddb.AttributeType.String
        }
    })

    // Create an S3 bucket nlp-voc-website to host website
    const websiteBucket = new s3.Bucket(this, 'nlp-voc-website', {
        websiteIndexDocument: 'unicornfeedback.html',
        publicReadAccess: true
      });
    
    // Deploy website to bucket
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
        source: s3deploy.Source.asset('./website-dist'),
        destinationBucket: websiteBucket
    });

    // Create a lambda function for writing feedbacks into DynamoDB
    const handlerEnterFeedback = new lambda.Function(this, "EnterCustomerFeedback", {
        runtime: lambda.Runtime.Python36,
        code: lambda.Code.directory("resources"),
        handler: "entercustomerfeedback.lambda_handler",
        environment: {
            table_name: table.tableName
        }
    });
    // Grant readwrite permission to EnterCustomerFeedback function on dynamodb table
    table.grantReadWriteData(handlerEnterFeedback);    

    // Create a lambda function for getting all feedbacks from DynamoDB
    const handlerGetAllFeedbacks = new lambda.Function(this, "GetAllCustomerFeedbacks", {
        runtime: lambda.Runtime.Python36,
        code: lambda.Code.directory("resources"),
        handler: "getallcustomerfeedbacks.lambda_handler",
        environment: {
            table_name: table.tableName
        }
    });
    // Grant read permission to GetAllCustomerFeedbacks function on dynamodb table
    table.grantReadData(handlerGetAllFeedbacks);    

    // Create API
    const api = new apigateway.RestApi(this, "cdk-nlp-api", {
        restApiName: "NLP demo Service",
        description: "This service is used for the CDK NLP demo."
    });
    
    // Correctly handle CORS for OPTIONS calls
    this.addCorsOptions(api.root);

    // Create API CRUD part for feedback
    const getFeedbackIntegration = new apigateway.LambdaIntegration(handlerGetAllFeedbacks, {
        requestTemplates: { "application/json": '{ "statusCode": "200" }' }
    });
 
    const postFeedbackIntegration = new apigateway.LambdaIntegration(handlerEnterFeedback, {
        requestTemplates: { "application/json": '{ "statusCode": "200" }' }
    });
    
    api.root.addMethod("GET", getFeedbackIntegration); 
    api.root.addMethod("POST", postFeedbackIntegration); 


    // Sentiment analysis
    // Create sentiment analysis lambda function
    const handlerPredict = new lambda.Function(this, "PredictFeedbackSentiment", {
        runtime: lambda.Runtime.Python36,
        code: lambda.Code.directory("resources"),
        handler: "predictfeedbacksentiment.lambda_handler",
        environment: {
            table_name: table.tableName
        }
    });
    
    // Grant readwrite permission to EnterCustomerFeedback function on dynamodb table
    // and give the right permission to call comprehend
    table.grantReadWriteData(handlerPredict);
    handlerPredict.addToRolePolicy(new iam.PolicyStatement()
        .addAction("comprehend:DetectSentiment")
        .addResource("*")
    );

    const getSentimentIntegration = new apigateway.LambdaIntegration(handlerPredict, {
        requestTemplates: { "application/json": '{ "statusCode": "200" }' }
    });

    const sentimentsResource = api.root.addResource("sentiment");
    const sentimentResource= sentimentsResource.addResource("{id}");

    this.addCorsOptions(sentimentResource);
    sentimentResource.addMethod("GET", getSentimentIntegration);

  }

  // This function helps fix CORS issues that will happen when browsers do an OPTION http call
  addCorsOptions(apiResource: apigateway.IRestApiResource) {
    apiResource.addMethod('OPTIONS', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
          'method.response.header.Access-Control-Allow-Origin': "'*'",
          'method.response.header.Access-Control-Allow-Credentials': "'false'",
          'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE'",
        },
      }],
      passthroughBehavior: apigateway.PassthroughBehavior.Never,
      requestTemplates: {
        "application/json": "{\"statusCode\": 200}"
      },
    }), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Credentials': true,
          'method.response.header.Access-Control-Allow-Origin': true,
        },  
      }]
    })
  }
}
