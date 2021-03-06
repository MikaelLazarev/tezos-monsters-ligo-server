import fs from 'fs';
import path from 'path';
import tmp from 'tmp';

import { logger } from './logger';

const { spawn } = require('child_process');
const dataDir = process.env['DATA_DIR'] || path.join(__dirname, 'tmp');

const JOB_TIMEOUT = 10000;


export class CompilerError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export interface Result{
  result: string;
  error: boolean;
}


export class LigoCompiler {
  private ligoCmd = process.env['LIGO_CMD'] || '/app/ligo' ;
  // process.env['LIGO_CMD'] || [
  //   'docker',
  //   'run',
  //   '-t',
  //   '--rm',
  //   '-v',
  //   `${dataDir}:${dataDir}`,
  //   '-w',
  //   dataDir,
  //   'ligolang/ligo:next'
  // ];

  private execPromise(cmd: string | string[], args: string[]): Promise<Result> {
    let command: string[] = [];
    if (Array.isArray(cmd)) {
      command = cmd;
    } else {
      command = cmd.split(' ');
    }

    let program = command[0];
    const argument = [...command.slice(1), ...args];

    return new Promise((resolve, reject) => {
      try {
        const result = spawn(program, argument, { shell: false, cwd: dataDir });
        let finalResult = '';
        let finalError = '';

        result.stdout.on('data', (data: Buffer) => {
          finalResult += data.toString();
        });

        result.stderr.on('data', (data: Buffer) => {
          finalError += data.toString();
        });

        result.on('close', (code: any) => {
          if (code === 0) {
            resolve({
              result: finalResult,
              error: false,

            });
          } else {
            resolve({
              result: finalResult,
              error: true,

            });
          }
        });
      } catch (ex) {
        logger.error(`Unexpected compiler error ${ex}`);
        reject(ex);
      }

      setTimeout(() => {
        reject(new Error(`command: ${cmd} Timed out after ${JOB_TIMEOUT} ms`));
      }, JOB_TIMEOUT);
    });
  }

  private createTemporaryFile(fileContent: string) {
    return new Promise<{ name: string; remove: () => void }>(
      (resolve, reject) => {
        tmp.file(
          { dir: dataDir, postfix: '.ligo' },
          (err, name, fd, remove) => {
            if (err) {
              reject(err);
              return;
            }

            fs.write(fd, Buffer.from(fileContent), err => {
              if (err) {
                reject(err);
                return;
              }

              resolve({
                name,
                remove: () => {
                  try {
                    remove();
                  } catch (ex) {
                    logger.error(`Unable to remove file ${name}`);
                  }
                  const ppFile = name.replace('.ligo', '.pp.ligo');
                  try {
                    if (fs.existsSync(ppFile)) {
                      fs.unlinkSync(ppFile);
                    }
                  } catch (ex) {
                    logger.error(`Unable to remove file ${ppFile}`);
                  }
                }
              });
            });
          }
        );
      }
    );
  }

  async compileContract(
    syntax: string,
    code: string,
    entrypoint: string,
    format: string
  ) {
    const { name, remove } = await this.createTemporaryFile(code);

    try {
      const result = await this.execPromise(this.ligoCmd, [
        'compile-contract',
        '--michelson-format',
        format,
        '-s',
        syntax,
        name,
        entrypoint
      ]);
      return result;
    }catch(e) {
      console.log(e);
    } 
    
    finally {
      remove();
    }
  }

  async compileExpression(syntax: string, expression: string, format: string) {
    const result = await this.execPromise(this.ligoCmd, [
      'compile-expression',
      '--michelson-format',
      format,
      syntax,
      expression
    ]);

    return result;
  }

  async compileStorage(
    syntax: string,
    code: string,
    entrypoint: string,
    format: string,
    storage: string
  ) {
    const { name, remove } = await this.createTemporaryFile(code);

    try {
      const result = await this.execPromise(this.ligoCmd, [
        'compile-storage',
        '--michelson-format',
        format,
        '-s',
        syntax,
        name,
        entrypoint,
        storage
      ]);

      return result;
    } finally {
      remove();
    }
  }

  async dryRun(
    syntax: string,
    code: string,
    entrypoint: string,
    parameter: string,
    storage: string
  ) {
    const { name, remove } = await this.createTemporaryFile(code);
    try {
      const result = await this.execPromise(this.ligoCmd, [
        'dry-run',
        '-s',
        syntax,
        name,
        entrypoint,
        parameter,
        storage
      ]);
      return result;
    } finally {
      remove();
    }
  }

  async evaluateValue(syntax: string, code: string, entrypoint: string) {
    const { name, remove } = await this.createTemporaryFile(code);
    try {
      const result = await this.execPromise(this.ligoCmd, [
        'evaluate-value',
        '-s',
        syntax,
        name,
        entrypoint
      ]);
      return result;
    } finally {
      remove();
    }
  }

  async runFunction(
    syntax: string,
    code: string,
    entrypoint: string,
    parameter: string
  ) {
    const { name, remove } = await this.createTemporaryFile(code);
    try {
      const result = await this.execPromise(this.ligoCmd, [
        'run-function',
        '-s',
        syntax,
        name,
        entrypoint,
        parameter
      ]);
      return result;
    } finally {
      remove();
    }
  }
}
