# CoCode Client
> CoTrain interview platform

## Basic Usage

```
# Install dependencies
npm install
# Perform a build
grunt build-prod
# Open the application
open build/index.html
```

## Production

To perform a production build, run the `prod` npm script:

```
npm run prod
```

The `build/` folder will contain the client, ready for deployment.


## Development

Install dependencies as usual:

```
npm install
```

Run Grunt, which performs a dev build then watches for changes:

```
grunt
```

When you pull, be sure to perform another `npm install` in case packages were updates.
