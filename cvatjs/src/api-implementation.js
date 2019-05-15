/*
* Copyright (C) 2018 Intel Corporation
* SPDX-License-Identifier: MIT
*/

/* global
    require:false
*/


(() => {
    const PluginRegistry = require('./plugins');
    const serverProxy = require('./server-proxy');

    function isBoolean(value) {
        return typeof (value) === 'boolean';
    }

    function isInteger(value) {
        return typeof (value) === 'number' && Number.isInteger(value);
    }

    function isEnum(value) {
        // Called with specific Enum context
        for (const key in this) {
            if (Object.prototype.hasOwnProperty.call(this, key)) {
                if (this[key] === value) {
                    return true;
                }
            }
        }

        return false;
    }

    function isString(value) {
        return typeof (value) === 'string';
    }

    function checkFilter(filter, fields) {
        for (const prop in filter) {
            if (Object.prototype.hasOwnProperty.call(filter, prop)) {
                if (!(prop in fields)) {
                    throw new window.cvat.exceptions.ArgumentError(
                        `Unsupported filter property has been recieved: "${prop}"`,
                    );
                } else if (!fields[prop](filter[prop])) {
                    throw new window.cvat.exceptions.ArgumentError(
                        `Received filter property ${prop} was not satisfied for checker`,
                    );
                }
            }
        }
    }

    const hidden = require('./hidden');
    function setupEnv(wrappedFunction) {
        return async function wrapper(...args) {
            try {
                if (this instanceof window.cvat.classes.Task) {
                    hidden.taskID = this.id;
                } else if (this instanceof window.cvat.classes.Job) {
                    hidden.jobID = this.id;
                    hidden.taskID = this.task.id;
                } else {
                    throw new window.cvat.exceptions.ScriptingError('Bad context for the function');
                }
                const result = await wrappedFunction.call(this, ...args);
                return result;
            } finally {
                delete hidden.taskID;
                delete hidden.jobID;
            }
        };
    }

    function implementAPI(cvat, jobAPI, taskAPI) {
        cvat.plugins.list.implementation = PluginRegistry.list;
        cvat.plugins.register.implementation = PluginRegistry.register;

        cvat.server.about.implementation = async () => {
            const result = await serverProxy.server.about();
            return result;
        };

        cvat.server.share.implementation = async (directory) => {
            const result = await serverProxy.server.share(directory);
            return result;
        };

        cvat.server.login.implementation = async (username, password) => {
            await serverProxy.server.login(username, password);
        };

        cvat.users.get.implementation = async (filter) => {
            checkFilter(filter, {
                self: isBoolean,
            });

            let users = null;
            if ('self' in filter && filter.self) {
                users = await serverProxy.users.getSelf();
                users = [users];
            } else {
                users = await serverProxy.users.getUsers();
            }

            users = users.map(user => new window.cvat.classes.User(user));
            return users;
        };

        cvat.jobs.get.implementation = async (filter) => {
            checkFilter(filter, {
                taskID: isInteger,
                jobID: isInteger,
            });

            if (('taskID' in filter) && ('jobID' in filter)) {
                throw new window.cvat.exceptions.ArgumentError(
                    'Only one of fields "taskID" and "jobID" allowed simultaneously',
                );
            }

            if (!Object.keys(filter).length) {
                throw new window.cvat.exceptions.ArgumentError(
                    'Job filter must not be empty',
                );
            }

            let task = null;
            if ('taskID' in filter) {
                task = await cvat.tasks.get.implementation({ id: filter.taskID });
            } else {
                const job = await serverProxy.jobs.getJob(filter.jobID);
                task = await cvat.tasks.get.implementation({ id: job.task_id });
            }

            task = new window.cvat.classes.Task(task[0]);
            return filter.jobID ? task.jobs.filter(job => job.id === filter.jobID) : task.jobs;
        };

        cvat.tasks.get.implementation = async (filter) => {
            checkFilter(filter, {
                name: isString,
                id: isInteger,
                owner: isString,
                assignee: isString,
                search: isString,
                status: isEnum.bind(window.cvat.enums.TaskStatus),
                mode: isEnum.bind(window.cvat.enums.TaskMode),
            });

            if ('search' in filter && Object.keys(filter).length > 1) {
                throw new window.cvat.exceptions.ArgumentError(
                    'Do not use the filter field "search" with others',
                );
            }

            if ('id' in filter && Object.keys(filter).length > 1) {
                throw new window.cvat.exceptions.ArgumentError(
                    'Do not use the filter field "id" with others',
                );
            }

            const searchParams = new URLSearchParams();
            for (const field of ['name', 'owner', 'assignee', 'search', 'status', 'mode', 'id']) {
                if (Object.prototype.hasOwnProperty.call(filter, field)) {
                    searchParams.set(field, filter[field]);
                }
            }

            let tasks = await serverProxy.tasks.getTasks(searchParams.toString());
            tasks = tasks.map(task => new window.cvat.classes.Task(task));

            return tasks;
        };

        jobAPI.annotations.upload.implementation = setupEnv(
            async (file) => {
                // TODO: Update annotations
            },
        );

        jobAPI.annotations.save.implementation = setupEnv(
            async () => {
                // TODO: Save annotation on a server
            },
        );

        jobAPI.annotations.clear.implementation = setupEnv(
            async () => {
                // TODO: Remove all annotations
            },
        );

        jobAPI.annotations.dump.implementation = setupEnv(
            async () => {
                const { host } = window.cvat.config;
                const { api } = window.cvat.config;

                return `${host}/api/${api}/tasks/${this.taskID}/annotations/dump`;
            },
        );

        jobAPI.annotations.statistics.implementation = setupEnv(
            async () => {
                return new Statistics();
            },
        );

        jobAPI.annotations.put.implementation = setupEnv(
            async (arrayOfObjects) => {
                // TODO: Make from objects
            },
        );

        jobAPI.annotations.get.implementation = setupEnv(
            async (frame, filter) => {
                return [new ObjectState()];
                // TODO: Return collection
            },
        );

        jobAPI.annotations.search.implementation = setupEnv(
            async (filter, frameFrom, frameTo) => {
                return 0;
            },
        );

        jobAPI.annotations.select.implementation = setupEnv(
            async (frame, x, y) => {
                return null;
            },
        );

        jobAPI.frames.get.implementation = setupEnv(
            async (frame) => {
                return new FrameData(this.taskID, frame);
            },
        );

        jobAPI.logs.put.implementation = setupEnv(
            async (logType, details) => {
                // TODO: Put log into collection
            },
        );

        jobAPI.logs.save.implementation = setupEnv(
            async () => {

            },
        );

        jobAPI.actions.undo.implementation = setupEnv(
            async (count) => {
                // TODO: Undo
            },
        );

        jobAPI.actions.redo.implementation = setupEnv(
            async (count) => {
                // TODO: Redo
            },
        );

        jobAPI.actions.clear.implementation = setupEnv(
            async () => {
                // TODO: clear
            },
        );

        jobAPI.events.subscribe.implementation = setupEnv(
            async (type, callback) => {
                // TODO: Subscribe
            }
        );

        jobAPI.events.unsubscribe.implementation = setupEnv(
            async (type, callback) => {
                // TODO: Save log collection
            },
        );

        taskAPI.annotations.upload.implementation = setupEnv(
            async (file) => {
                // TODO: Update annotations
            },
        );

        taskAPI.annotations.save.implementation = setupEnv(
            async () => {
                // TODO: Save annotation on a server
            },
        );

        taskAPI.annotations.clear.implementation = setupEnv(
            async () => {
                // TODO: Remove all annotations
            },
        );

        taskAPI.annotations.dump.implementation = setupEnv(
            async () => {
                const { host } = window.cvat.config;
                const { api } = window.cvat.config;

                return `${host}/api/${api}/tasks/${this.taskID}/annotations/dump`;
            },
        );

        taskAPI.annotations.statistics.implementation = setupEnv(
            async () => {
                return new Statistics();
            },
        );

        taskAPI.annotations.put.implementation = setupEnv(
            async (arrayOfObjects) => {
                // TODO: Make from objects
            },
        );

        taskAPI.annotations.get.implementation = setupEnv(
            async (frame, filter) => {
                return [new ObjectState()];
                // TODO: Return collection
            },
        );

        taskAPI.annotations.search.implementation = setupEnv(
            async (filter, frameFrom, frameTo) => {
                return 0;
            },
        );

        taskAPI.annotations.select.implementation = setupEnv(
            async (frame, x, y) => {
                return null;
            },
        );

        taskAPI.frames.get.implementation = setupEnv(
            async (frame) => {
                return new FrameData(this.taskID, frame);
            },
        );

        taskAPI.logs.put.implementation = setupEnv(
            async (logType, details) => {
                // TODO: Put log into collection
            },
        );

        taskAPI.logs.save.implementation = setupEnv(
            async () => {

            },
        );

        taskAPI.actions.undo.implementation = setupEnv(
            async (count) => {
                // TODO: Undo
            },
        );

        taskAPI.actions.redo.implementation = setupEnv(
            async (count) => {
                // TODO: Redo
            },
        );

        taskAPI.actions.clear.implementation = setupEnv(
            async () => {
                // TODO: clear
            },
        );

        taskAPI.events.subscribe.implementation = setupEnv(
            async (type, callback) => {
                // TODO: Subscribe
            }
        );

        taskAPI.events.unsubscribe.implementation = setupEnv(
            async (type, callback) => {
                // TODO: Save log collection
            },
        );

        return cvat;
    }

    module.exports = implementAPI;
})();