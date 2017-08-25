git filter-branch --env-filter \
    'if [ $GIT_COMMIT = d5118d58c75d41967d89ad8264b224382e0783d1 ]
     then
         export GIT_AUTHOR_DATE="Thu Aug 24 22:25:08 2017 +0530"
         export GIT_COMMITTER_DATE="Thu Aug 24 22:15:08 2017 +0530"
     fi'

rm -rf .git/refs/original