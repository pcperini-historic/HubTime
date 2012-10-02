#!/usr/bin/python

# Imports
import sys
import cgi
import jinja2
import urllib2
from pygithub3 import Github

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
    
        githubInstance = Github(login = username, password = password)
        
        if target == 'user':
            user = githubInstance.users.get()
            write(str(user))
            
        elif target == 'repos':
            pass
            
        elif target == 'milestones':
            pass
            
        elif target == 'issues':
            pass
            
        elif target == 'comments':
            pass    