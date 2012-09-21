#!/usr/bin/python

# Imports
import sys
import cgi
import jinja2
from libs.github import github

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
        username = form.getvalue('username')
        password = form.getvalue('password')
    
        githubConnection = github.GitHub(username, password)
        githubUser = githubConnection.users.show(username)
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