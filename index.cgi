#!/usr/bin/python

# Imports
import jinja2

# Globals
environment = jinja2.Environment(loader = jinja2.PackageLoader(__name__))

if __name__ == "__main__":
    form = cgi.FieldStorage()
    method = form.getvalue('method')
    target = form.getvalue('target')

    if not method and not target:
        template = environment.get_template('index.html')
        print "Content-Type: text/html\n"
        print template.render()