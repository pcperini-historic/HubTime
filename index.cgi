#!/usr/bin/python

# Imports
import sys
import cgi
import jinja2
import urllib2
from libs import github

# Globals
environment = jinja2.Environment(loader = jinja2.PackageLoader(__name__))

# Functions
def write(content, type = "text/plain"):
    print "Content-Type: " + type + "\n"
    print content
    
    sys.exit(0)

if __name__ == "__main__":
    form = cgi.FieldStorage()
    method = form.getvalue('method')
    target = form.getvalue('target')

    if not method and not target:
        template = environment.get_template('index.html')
        write(template.render(), "text/html")
    
    else: # API
        username = urllib2.unquote(form.getvalue('username'))
        password = urllib2.unquote(form.getvalue('password'))
        write(username+" "+password)
    
        githubUser = github.user(username, password)
        write(str(githubUser))
        
        if target == 'user':
            pass
            
        elif target == 'repos':
            pass
            
        elif target == 'milestones':
            pass
            
        elif target == 'issues':
            pass
            
        elif target == 'comments':
            pass    