#!/usr/bin/env gjs

imports.gi.versions.Gtk = '4.0'; // Use GTK 4 (required by WebKit 6.0 and Adw 1)
imports.gi.versions.Adw = '1';

// Add current directory to GJS search path
imports.searchPath.unshift('.');

const { Gtk, Gio } = imports.gi;
const { Application } = imports.app;

const appId = 'org.hardcoeur.SimplyLoev';
const app = new Application({ application_id: appId });

app.run([imports.system.programInvocationName].concat(ARGV));