#!/usr/bin/python

# Imports
import jinja2

# Globals
environment = jinja2.Environment(loader = jinja2.PackageLoader(__name__))

if __name__ == "__main__":
    template = environment.get_template('index.html')
    print "Content-Type: text/html\n"
    print template.render()