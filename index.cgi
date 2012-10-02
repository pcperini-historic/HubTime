#!/usr/bin/python

# Imports
import sys
import cgi
import json
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
            if method == 'GET':
                user = githubInstance.users.get()
                userInfo = {
                    'login': user.login,
                    'name': user.name,
                    'avatar_url': user.avatar_url
                }
                write(json.dumps(userInfo), "application/json")
            
        elif target == 'repos':
            if method == 'GET':
                repoPages = [page for page in githubInstance.repos.list()]
    
                repos = []
                for repo in repoPages:
                    repos.extend(repo)
                
                repos = [{
                    'name': repo.name
                } for repo in repos]
                write(json.dumps(repos), "application/json")
            
        elif target == 'milestones':
            if method == 'GET':
                repo = urllib2.unquote(form.getvalue('repo'))
                milestonePages = [page for page in githubInstance.issues.milestones.list(user = username, repo = repo)]
                
                milestones = []
                for milestone in milestonePages:
                    milestones.extend(milestone)
                    
                milestones = [{
                    'title': milestone.title,
                    'number': milestone.number
                } for milestone in milestones]
                write(json.dumps(milestones), "application/json")
            
        elif target == 'issues':
            if method == 'GET':
                repo = urllib2.unquote(form.getvalue('repo'))
                milestone = form.getvalue('milestone')
                
                issuePages = [page for page in githubInstance.issues.list_by_repo(user = username, repo = repo, milestone = milestone, assignee='none', labels='HubTime')]
                issuePages.extend([page for page in githubInstance.issues.list_by_repo(user = username, repo = repo, milestone = milestone, assignee='*', labels='HubTime')])
                
                issues = []
                for issue in issuePages:
                    issues.extend(issue)
                    
                issues = [{
                    'title': issue.title,
                    'number': issue.number,
                    'html_url': issue.html_url,
                    'milestone_number': issue.milestone.number
                } for issue in issues]
                write(json.dumps(issues), "application/json")
            
        elif target == 'comments':
            if method == 'GET':
                repo = urllib2.unquote(form.getvalue('repo'))
                issue = int(form.getvalue('issue'))
                
                commentPages = [page for page in githubInstance.issues.comments.list(issue, user = username, repo = repo)]
                
                comments = []
                for comment in commentPages:
                    comments.extend(comment)
                    
                issue = githubInstance.issues.get(issue, user = username, repo = repo)
                    
                comments = [{
                    'id': comment.id,
                    'body': comment.body,
                    'issue':
                    {
                        'title': issue.title,
                        'number': issue.number,
                        'html_url': issue.html_url,
                        'milestone_number': issue.milestone.number
                    }
                } for comment in comments if comment.user.login == username]
                write(json.dumps(comments), "application/json")
                
            elif method == 'ADD':
                repo = urllib2.unquote(form.getvalue('repo'))
                issue = int(form.getvalue('issue'))
                body = urllib2.unquote(form.getvalue('body'))
                
                githubInstance.issues.comments.create(issue, body, user = username, repo = repo)
                write('true', "application/json")
                
            elif method == 'DEL':
                repo = urllib2.unquote(form.getvalue('repo'))
                comment = int(form.getvalue('comment'))
                
                githubInstance.issues.comments.delete(comment, user = username, repo = repo)
                write('true', "application/json")