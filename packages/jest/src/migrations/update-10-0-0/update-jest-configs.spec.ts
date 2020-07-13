import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import * as path from 'path';
import { serializeJson } from '@nrwl/workspace';
import { jestConfigObject } from '../../..';

describe('update 10.0.0', () => {
  let initialTree: Tree;
  let schematicRunner: SchematicTestRunner;

  const jestConfig = String.raw`
    module.exports = {    
      name: 'test-jest',
      preset: '../../jest.config.js',
      coverageDirectory: '../../coverage/libs/test-jest',
      globals: {
        "existing-global": "test"
      },
      snapshotSerializers: [
        'jest-preset-angular/build/AngularNoNgAttributesSnapshotSerializer.js',
        'jest-preset-angular/build/AngularSnapshotSerializer.js',
        'jest-preset-angular/build/HTMLCommentSerializer.js'
      ]
    }
  `;

  const jestConfigReact = String.raw`
  module.exports = {    
      name: 'my-react-app',
      preset: '../../jest.config.js',
      transform: {
        '^(?!.*\\\\.(js|jsx|ts|tsx|css|json)$)': '@nrwl/react/plugins/jest',
        '^.+\\\\.[tj]sx?$': [
          'babel-jest',
          { cwd: __dirname, configFile: './babel-jest.config.json' }
        ]
      },
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
      coverageDirectory: '../../coverage/apps/my-react-app'
    }
  `;

  beforeEach(() => {
    initialTree = createEmptyWorkspace(Tree.empty());

    initialTree.create('apps/products/jest.config.js', jestConfig);
    initialTree.create(
      'apps/products/src/test-setup.ts',
      `import 'jest-preset-angular'`
    );
    initialTree.create('apps/cart/jest.config.js', jestConfigReact);
    initialTree.overwrite(
      'workspace.json',
      serializeJson({
        version: 1,
        projects: {
          products: {
            root: 'apps/products',
            sourceRoot: 'apps/products/src',
            architect: {
              build: {
                builder: '@angular-devkit/build-angular:browser',
              },
              test: {
                builder: '@nrwl/jest:jest',
                options: {
                  jestConfig: 'apps/products/jest.config.js',
                  tsConfig: 'apps/products/tsconfig.spec.json',
                  setupFile: 'apps/products/src/test-setup.ts',
                  passWithNoTests: true,
                },
              },
            },
          },
          cart: {
            root: 'apps/cart',
            sourceRoot: 'apps/cart/src',
            architect: {
              build: {
                builder: '@nrwl/web:build',
              },
              test: {
                builder: '@nrwl/jest:jest',
                options: {
                  jestConfig: 'apps/cart/jest.config.js',
                  passWithNoTests: true,
                },
              },
            },
          },
        },
      })
    );
    schematicRunner = new SchematicTestRunner(
      '@nrwl/jest',
      path.join(__dirname, '../../../migrations.json')
    );
  });

  it('should remove setupFile and tsconfig in test architect from workspace.json', async (done) => {
    const result = await schematicRunner
      .runSchematicAsync('update-10.0.0', {}, initialTree)
      .toPromise();

    const updatedWorkspace = JSON.parse(result.readContent('workspace.json'));
    expect(updatedWorkspace.projects.products.architect.test.options).toEqual({
      jestConfig: expect.anything(),
      passWithNoTests: expect.anything(),
    });
    expect(updatedWorkspace.projects.cart.architect.test.options).toEqual({
      jestConfig: expect.anything(),
      passWithNoTests: expect.anything(),
    });
    done();
  });

  it('should update the jest.config files', async (done) => {
    await schematicRunner
      .runSchematicAsync('update-10.0.0', {}, initialTree)
      .toPromise();

    const jestObject = jestConfigObject(
      initialTree,
      'apps/products/jest.config.js'
    );

    const angularSetupFiles = jestObject.setupFilesAfterEnv;
    const angularGlobals = jestObject.globals;

    expect(angularSetupFiles).toEqual(['<rootDir>/src/test-setup.ts']);
    expect(angularGlobals).toEqual({
      'existing-global': 'test',
      'ts-jest': {
        tsConfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
        astTransformers: [
          'jest-preset-angular/build/InlineFilesTransformer',
          'jest-preset-angular/build/StripStylesTransformer',
        ],
      },
    });

    const reactJestObject = jestConfigObject(
      initialTree,
      'apps/cart/jest.config.js'
    );

    const reactSetupFiles = reactJestObject.setupFilesAfterEnv;
    const reactGlobals = reactJestObject.globals;
    expect(reactSetupFiles).toBeUndefined();
    expect(reactGlobals).toBeUndefined();

    done();
  });
});