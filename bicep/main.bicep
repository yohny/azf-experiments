param location string = resourceGroup().location

@minLength(3)
@maxLength(24)
param storageAccountName string = 'store${uniqueString(resourceGroup().id)}'
param functionAppName string = '${uniqueString(resourceGroup().id)}'

resource virtualNetwork 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: 'examplevnet'
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.0.0.0/16'
      ]
    }
    subnets: [
      {
        name: 'Subnet-1'
        properties: {
          addressPrefix: '10.0.0.0/24'
        }
      }
      {
        name: 'Subnet-2'
        properties: {
          addressPrefix: '10.0.1.0/24'
        }
      }
    ]
  }
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
}

resource azf 'Microsoft.Web/sites/functions@2023-12-01' = {
  name: '${functionAppName}/examplefunctionapp'
}
